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

export type ActivatedEventPayload = {
  id?: string | null;
  name?: string | null;
  theatre?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  genre?: string | null;
  base_rewards?: {
    xp?: number | null;
    reputation?: number | null;
    cachet?: number | null;
  } | null;
  focus_role?: string | null;
};

const LEGACY_PROTOCOL_PREFIX = 'turni://ticket/';
const localActivationStore = new Map<string, TicketActivationRecord>();
const SESSION_REQUIRED_MESSAGE = 'Sessione scaduta o non disponibile. Effettua di nuovo il login.';

async function resolveFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const candidate = error as {
    message?: unknown;
    context?: {
      status?: number;
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
      clone?: () => unknown;
    };
  };

  let message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
  const context = candidate.context;

  if (context && typeof context === 'object') {
    const cloneFn = typeof context.clone === 'function' ? context.clone.bind(context) : null;
    const source = cloneFn ? (cloneFn() as typeof context) : context;

    if (source && typeof source.json === 'function') {
      try {
        const body = await source.json();
        if (body && typeof body === 'object') {
          const payload = body as { error?: unknown; message?: unknown };
          const bodyMessage =
            (typeof payload.error === 'string' && payload.error.trim()) ||
            (typeof payload.message === 'string' && payload.message.trim()) ||
            '';
          if (bodyMessage) {
            if (/invalid jwt/i.test(bodyMessage)) {
              return SESSION_REQUIRED_MESSAGE;
            }
            return bodyMessage;
          }
        }
      } catch {
        // fall back to text/message below
      }
    }

    const sourceForText = cloneFn ? (cloneFn() as typeof context) : context;
    if (sourceForText && typeof sourceForText.text === 'function') {
      try {
        const text = (await sourceForText.text()).trim();
        if (text) {
          if (/invalid jwt/i.test(text)) {
            return SESSION_REQUIRED_MESSAGE;
          }
          return text;
        }
      } catch {
        // ignore and continue fallback
      }
    }

    if (typeof context.status === 'number' && context.status > 0) {
      if (context.status === 401) {
        return SESSION_REQUIRED_MESSAGE;
      }
      if (message) {
        return `HTTP ${context.status}: ${message}`;
      }
      return `HTTP ${context.status}: ${fallback}`;
    }
  }

  if (/invalid jwt/i.test(message)) {
    return SESSION_REQUIRED_MESSAGE;
  }

  if (!message || /non-2xx/i.test(message)) {
    return fallback;
  }

  return message;
}

function getFunctionErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const context = (error as { context?: { status?: unknown } }).context;
  if (!context || typeof context !== 'object') return null;
  return typeof context.status === 'number' ? context.status : null;
}

async function getAccessTokenForFunctions(): Promise<string> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(SESSION_REQUIRED_MESSAGE);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(SESSION_REQUIRED_MESSAGE);
  }

  const sessionToken = sessionData.session?.access_token?.trim();
  if (sessionToken) return sessionToken;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw new Error(SESSION_REQUIRED_MESSAGE);
  }

  const refreshedToken = refreshed.session?.access_token?.trim();
  if (!refreshedToken) {
    throw new Error(SESSION_REQUIRED_MESSAGE);
  }

  return refreshedToken;
}

async function invokeTicketActivation(body: Record<string, unknown>) {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: null };
  }

  const token = await getAccessTokenForFunctions();
  let response = await supabase.functions.invoke('ticket-activation', {
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

  // Retry once with a refreshed token if gateway rejects the request.
  if (response.error && getFunctionErrorStatus(response.error) === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    const refreshedToken = refreshed.session?.access_token?.trim();
    if (!refreshError && refreshedToken) {
      response = await supabase.functions.invoke('ticket-activation', {
        headers: { Authorization: `Bearer ${refreshedToken}` },
        body,
      });
    }
  }

  return response;
}

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

  const { data, error } = await invokeTicketActivation({
    action: 'reserve_hash',
    hash,
    payload,
  });

  if (error) {
    const errorMessage = await resolveFunctionErrorMessage(
      error,
      'Errore Supabase durante la prenotazione hash.'
    );
    throw new Error(errorMessage);
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
    qrValue: hash,
    persistedRemotely,
  };
}

export function parseTicketQrValue(input: string): string | null {
  const trimmed = input.trim();

  // Preferred format: raw 64-char SHA-256 hash.
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Backward compatibility for legacy QR values.
  if (trimmed.startsWith(LEGACY_PROTOCOL_PREFIX)) {
    const hash = trimmed.slice(LEGACY_PROTOCOL_PREFIX.length).split('?')[0]?.toLowerCase();
    if (hash && /^[0-9a-f]{64}$/.test(hash)) return hash;
  }

  return null;
}

async function activateRemotely(hash: string, userId: string) {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await invokeTicketActivation({
    action: 'activate_hash',
    hash,
    userId,
  });

  if (error) {
    const errorMessage = await resolveFunctionErrorMessage(
      error,
      'Errore Supabase durante l\'attivazione ticket.'
    );
    throw new Error(errorMessage);
  }

  return data as {
    ok?: boolean;
    alreadyActivated?: boolean;
    activatedBy?: string;
    eventId?: string;
    eventName?: string;
    event?: ActivatedEventPayload;
    error?: string;
  } | null;
}

export async function activateTicketHash(
  hash: string,
  userId: string
): Promise<{ ok: true; eventId?: string; event?: ActivatedEventPayload } | { ok: false; error: string }> {
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
      return { ok: true, eventId: remote.eventId, event: remote.event };
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
): Promise<{ ok: true; eventId?: string; event?: ActivatedEventPayload } | { ok: false; error: string }> {
  const normalizedEventId = eventID.trim();
  const normalizedTicket = ticketNumber.trim();
  const normalizedUserId = userId.trim();

  if (!normalizedEventId || !normalizedTicket || !normalizedUserId) {
    return { ok: false, error: 'Dati mancanti per l\'attivazione manuale.' };
  }

  try {
    if (!supabase || !isSupabaseConfigured) return { ok: false, error: 'Supabase non configurata.' };

    const { data, error } = await invokeTicketActivation({
      action: 'activate_by_details',
      payload: { eventID: normalizedEventId, ticketNumber: normalizedTicket },
      userId: normalizedUserId,
    });

    if (error) {
      const errorMessage = await resolveFunctionErrorMessage(
        error,
        'Errore Supabase durante l\'attivazione manuale.'
      );
      throw new Error(errorMessage);
    }
    const remote = data as {
      ok?: boolean;
      alreadyActivated?: boolean;
      error?: string;
      eventId?: string;
      event?: ActivatedEventPayload;
    } | null;

    if (remote?.ok) return { ok: true, eventId: remote.eventId, event: remote.event };
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
