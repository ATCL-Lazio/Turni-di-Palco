import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type TicketPayload = {
  circuit: string;
  eventName: string;
  eventID: string;
  ticketNumber: string;
  date: string;
};

export type GeneratedTicket = {
  payload: TicketPayload;
  json: string;
  hash: string;
  qrValue: string;
  persistedRemotely: boolean;
};

export type TicketActivationRecord = {
  hash: string;
  ticketNumber: string;
  status: 'generated' | 'activated';
  activatedBy: string | null;
  activatedAtIso: string | null;
};

const PROTOCOL_PREFIX = 'turni://ticket/';
const localActivationStore = new Map<string, TicketActivationRecord>();

function stableStringify(value: TicketPayload): string {
  return JSON.stringify({
    circuit: value.circuit,
    eventName: value.eventName,
    eventID: value.eventID,
    ticketNumber: value.ticketNumber,
    date: value.date,
  });
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function reserveHashRemotely(payload: TicketPayload, hash: string) {
  if (!supabase || !isSupabaseConfigured) return false;

  const { data, error } = await supabase.functions.invoke('ticket-activation', {
    body: {
      action: 'reserve_hash',
      hash,
      payload,
    },
  });

  if (error) {
    throw new Error(error.message || 'Errore Supabase durante la prenotazione hash.');
  }

  return Boolean((data as { reserved?: boolean } | null)?.reserved);
}

export async function generateTicketQr(params: {
  circuit: string;
  eventName: string;
  eventID: string;
  ticketNumber: string;
  date: string;
}): Promise<GeneratedTicket> {
  const payload: TicketPayload = {
    circuit: params.circuit.trim(),
    eventName: params.eventName.trim(),
    eventID: params.eventID.trim(),
    ticketNumber: params.ticketNumber.trim(),
    date: params.date.trim(),
  };

  if (!payload.circuit || !payload.eventName || !payload.eventID || !payload.ticketNumber || !payload.date) {
    throw new Error('Compila tutti i campi richiesti del JSON ticket.');
  }

  const json = stableStringify(payload);
  const hash = await sha256Hex(json);

  if (localActivationStore.has(hash)) {
    throw new Error('Hash già presente in archivio locale: controlla i dati ticket.');
  }

  let persistedRemotely = false;
  try {
    const reserved = await reserveHashRemotely(payload, hash);
    persistedRemotely = reserved;
    if (supabase && isSupabaseConfigured && !reserved) {
      throw new Error('Hash già esistente su Supabase: modifica il ticket e rigenera.');
    }
  } catch (error) {
    if (supabase && isSupabaseConfigured) {
      throw error instanceof Error ? error : new Error('Errore durante la registrazione hash su Supabase.');
    }
    persistedRemotely = false;
  }

  localActivationStore.set(hash, {
    hash,
    ticketNumber: payload.ticketNumber,
    status: 'generated',
    activatedBy: null,
    activatedAtIso: null,
  });

  return {
    payload,
    json,
    hash,
    qrValue: `${PROTOCOL_PREFIX}${hash}`,
    persistedRemotely,
  };
}

export function parseTicketQrValue(input: string): string | null {
  const trimmed = input.trim();
  
  // if starts with protocol, extract hash
  if (trimmed.startsWith(PROTOCOL_PREFIX)) {
    const hash = trimmed.slice(PROTOCOL_PREFIX.length).split('?')[0]?.toLowerCase();
    if (hash && /^[0-9a-f]{64}$/.test(hash)) return hash;
  }

  // if is raw 64-char hex hash, return it directly
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}

async function activateRemotely(hash: string, userId: string) {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await supabase.functions.invoke('ticket-activation', {
    body: {
      action: 'activate_hash',
      hash,
      userId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Errore Supabase durante l\'attivazione.');
  }

  return data as { ok?: boolean; alreadyActivated?: boolean; activatedBy?: string; error?: string } | null;
}

export async function activateTicketHash(
  hash: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedHash = hash.trim().toLowerCase();
  const normalizedUserId = userId.trim();

  if (!/^[0-9a-f]{64}$/.test(normalizedHash)) {
    return { ok: false, error: 'Hash non valido.' };
  }

  if (!normalizedUserId) {
    return { ok: false, error: 'Utente non disponibile per l\'attivazione.' };
  }

  try {
    const remote = await activateRemotely(normalizedHash, normalizedUserId);
    
    if (remote?.ok) {
      const currentRecord = localActivationStore.get(normalizedHash);
      localActivationStore.set(normalizedHash, {
        hash: normalizedHash,
        ticketNumber: currentRecord?.ticketNumber ?? 'N/A',
        status: 'activated',
        activatedBy: normalizedUserId,
        activatedAtIso: new Date().toISOString(),
      });
      return { ok: true };
    }

    if (remote?.alreadyActivated) {
      return { ok: false, error: 'Ticket già attivato da un altro utente.' };
    }

    if (remote?.error) {
      return { ok: false, error: remote.error };
    }
  } catch (error) {
    console.error('Remote activation failed:', error);
    if (supabase && isSupabaseConfigured) {
      return { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Errore durante la comunicazione con il server.' 
      };
    }
  }

  const record = localActivationStore.get(normalizedHash);
  if (!record) {
    return { ok: false, error: 'Ticket non trovato.' };
  }

  if (record.status === 'activated') {
    return { ok: false, error: 'Ticket già attivato.' };
  }

  localActivationStore.set(normalizedHash, {
    ...record,
    status: 'activated',
    activatedBy: normalizedUserId,
    activatedAtIso: new Date().toISOString(),
  });

  return { ok: true };
}

export async function activateTicketByDetails(
  eventID: string,
  ticketNumber: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedEventId = eventID.trim();
  const normalizedTicket = ticketNumber.trim();
  const normalizedUserId = userId.trim();

  if (!normalizedEventId || !normalizedTicket || !normalizedUserId) {
    return { ok: false, error: 'Dati mancanti per l\'attivazione manuale.' };
  }

  try {
    if (!supabase || !isSupabaseConfigured) return { ok: false, error: 'Supabase non configurata.' };

    const { data, error } = await supabase.functions.invoke('ticket-activation', {
      body: {
        action: 'activate_by_details',
        payload: { eventID: normalizedEventId, ticketNumber: normalizedTicket },
        userId: normalizedUserId,
      },
    });

    if (error) throw new Error(error.message);
    const remote = data as { ok?: boolean; alreadyActivated?: boolean; error?: string } | null;

    if (remote?.ok) return { ok: true };
    if (remote?.alreadyActivated) return { ok: false, error: 'Ticket già attivato.' };
    return { ok: false, error: remote?.error || 'Errore durante l\'attivazione manuale.' };
  } catch (error) {
    console.error('Manual activation failed:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Errore tecnico.' };
  }
}

export function listLocalTicketRecords(): TicketActivationRecord[] {
  return Array.from(localActivationStore.values()).sort((a, b) => a.hash.localeCompare(b.hash));
}
