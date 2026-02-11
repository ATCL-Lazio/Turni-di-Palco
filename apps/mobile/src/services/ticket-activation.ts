import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type TicketPayload = {
  source: string;
  ticketCode: string;
  theatreId: string;
  performanceIso: string;
  issuedAtIso: string;
  salt: number;
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
  ticketCode: string;
  status: 'generated' | 'activated';
  activatedBy: string | null;
  activatedAtIso: string | null;
};

const PROTOCOL_PREFIX = 'turni://ticket/';
const localActivationStore = new Map<string, TicketActivationRecord>();

function stableStringify(value: TicketPayload): string {
  return JSON.stringify({
    source: value.source,
    ticketCode: value.ticketCode,
    theatreId: value.theatreId,
    performanceIso: value.performanceIso,
    issuedAtIso: value.issuedAtIso,
    salt: value.salt,
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
  ticketCode: string;
  theatreId: string;
  performanceIso: string;
  source?: string;
  maxAttempts?: number;
}): Promise<GeneratedTicket> {
  const ticketCode = params.ticketCode.trim().toUpperCase();
  const theatreId = params.theatreId.trim();
  const performanceIso = params.performanceIso.trim();
  const source = (params.source ?? 'ticket-office').trim();
  const maxAttempts = params.maxAttempts ?? 8;

  if (!ticketCode || !theatreId || !performanceIso) {
    throw new Error('Compila ticket, teatro e data performance.');
  }

  for (let salt = 0; salt < maxAttempts; salt += 1) {
    const payload: TicketPayload = {
      source,
      ticketCode,
      theatreId,
      performanceIso,
      issuedAtIso: new Date().toISOString(),
      salt,
    };

    const json = stableStringify(payload);
    const hash = await sha256Hex(json);
    const localCollision = localActivationStore.has(hash);
    if (localCollision) continue;

    let persistedRemotely = false;
    try {
      const reserved = await reserveHashRemotely(payload, hash);
      persistedRemotely = reserved;
      if (supabase && isSupabaseConfigured && !reserved) {
        continue;
      }
    } catch {
      persistedRemotely = false;
    }

    localActivationStore.set(hash, {
      hash,
      ticketCode,
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

  throw new Error('Collisione hash ripetuta: aumenta la complessità del payload.');
}

export function parseTicketQrValue(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith(PROTOCOL_PREFIX)) return null;

  const hash = trimmed.slice(PROTOCOL_PREFIX.length).split('?')[0]?.toLowerCase();
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  return hash;
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

  return data as { ok?: boolean; alreadyActivated?: boolean; activatedBy?: string } | null;
}

export async function activateTicketHash(hash: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedHash = hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalizedHash)) {
    return { ok: false, error: 'Hash non valido.' };
  }

  if (!userId.trim()) {
    return { ok: false, error: 'Utente non disponibile per l\'attivazione.' };
  }

  try {
    const remote = await activateRemotely(normalizedHash, userId.trim());
    if (remote?.alreadyActivated) {
      return { ok: false, error: 'Ticket già attivato da un altro utente.' };
    }
    if (remote?.ok) {
      return { ok: true };
    }
  } catch {
    // fallback locale
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
    activatedBy: userId,
    activatedAtIso: new Date().toISOString(),
  });

  return { ok: true };
}

export function listLocalTicketRecords(): TicketActivationRecord[] {
  return Array.from(localActivationStore.values()).sort((a, b) => a.hash.localeCompare(b.hash));
}
