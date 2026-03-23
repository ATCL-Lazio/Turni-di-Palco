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
  eventId: string;
  ticketNumber: string;
  status: 'generated' | 'activated';
  activatedBy: string | null;
  activatedAtIso: string | null;
};

type ManualTicketActivationRecord = {
  eventId: string;
  ticketNumber: string;
  activatedBy: string;
  activatedAtIso: string;
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
const localManualActivationStore = new Map<string, ManualTicketActivationRecord>();
const SESSION_REQUIRED_MESSAGE = 'Sessione scaduta o non disponibile. Effettua di nuovo il login.';
const TOKEN_REFRESH_SKEW_SECONDS = 30;
const MAX_STORE_SIZE = 1000; // Prevent memory leaks
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Cleanup function to prevent memory leaks
function cleanupOldRecords() {
  if (localActivationStore.size > MAX_STORE_SIZE) {
    const entries = Array.from(localActivationStore.entries());
    // Keep only the most recent half
    const toKeep = entries.slice(-Math.floor(MAX_STORE_SIZE / 2));
    localActivationStore.clear();
    toKeep.forEach(([key, value]) => localActivationStore.set(key, value));
  }

  if (localManualActivationStore.size > MAX_STORE_SIZE) {
    const entries = Array.from(localManualActivationStore.entries());
    const toKeep = entries.slice(-Math.floor(MAX_STORE_SIZE / 2));
    localManualActivationStore.clear();
    toKeep.forEach(([key, value]) => localManualActivationStore.set(key, value));
  }
}

function buildManualTicketKey(eventID: string, ticketNumber: string): string {
  return `${eventID.trim().toLowerCase()}::${ticketNumber.trim().toLowerCase()}`;
}

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

async function invalidateAuthSession() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore logout failures
  }
}

function shouldLogActivationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return !/sessione scaduta|invalid jwt|unauthorized|401/i.test(message);
}

async function getAccessTokenForFunctions(): Promise<string> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(SESSION_REQUIRED_MESSAGE);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    await invalidateAuthSession();
    throw new Error(SESSION_REQUIRED_MESSAGE);
  }

  const session = sessionData.session;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const sessionToken = session?.access_token?.trim();
  const expiresAt = typeof session?.expires_at === 'number' ? session.expires_at : 0;
  const shouldRefresh =
    !sessionToken || !expiresAt || expiresAt <= nowSeconds + TOKEN_REFRESH_SKEW_SECONDS;

  if (!shouldRefresh && sessionToken) {
    return sessionToken;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    await invalidateAuthSession();
    throw new Error(SESSION_REQUIRED_MESSAGE);
  }

  const refreshedToken = refreshed.session?.access_token?.trim();
  if (!refreshedToken) {
    await invalidateAuthSession();
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
    if (response.error && getFunctionErrorStatus(response.error) === 401) {
      await invalidateAuthSession();
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
  let persistedRemotely = false;

  if (localActivationStore.has(hash)) {
    throw new Error('Ticket gia generato in questa sessione. Verifica eventID e ticketNumber.');
  }

  if (supabase && isSupabaseConfigured) {
    try {
      const reserved = await reserveHashRemotely(payload, hash);
      if (!reserved) {
        throw new Error(
          'Ticket gia presente su Supabase. Verifica eventID e ticketNumber (potrebbe essere un duplicato).'
        );
      }
      persistedRemotely = true;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Errore durante la registrazione hash su Supabase.');
    }
  }

  cleanupOldRecords();
  localActivationStore.set(hash, {
    hash,
    eventId: payload.eventID,
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

export function isTicketHashActivatedInSession(hash: string): boolean {
  const normalizedHash = hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalizedHash)) return false;
  return localActivationStore.get(normalizedHash)?.status === 'activated';
}

export function isManualTicketActivatedInSession(eventID: string, ticketNumber: string): boolean {
  const key = buildManualTicketKey(eventID, ticketNumber);
  return localManualActivationStore.has(key);
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

async function resolveRemotely(hash: string) {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data, error } = await invokeTicketActivation({
    action: 'resolve_hash',
    hash,
  });

  if (error) {
    const errorMessage = await resolveFunctionErrorMessage(
      error,
      'Errore Supabase durante la risoluzione del ticket.'
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

export async function resolveTicketHashPreview(
  hash: string
): Promise<{ ok: true; eventId: string; event?: ActivatedEventPayload } | { ok: false; error: string }> {
  const normalizedHash = hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalizedHash)) {
    return { ok: false, error: 'Hash non valido.' };
  }

  const localRecord = localActivationStore.get(normalizedHash);
  if (localRecord?.status === 'activated') {
    return { ok: false, error: 'Ticket già attivato.' };
  }

  try {
    const remote = await resolveRemotely(normalizedHash);
    if (!remote) {
      if (localRecord?.eventId) {
        return { ok: true, eventId: localRecord.eventId };
      }
      return { ok: false, error: 'Ticket non trovato.' };
    }

    if (remote.ok && remote.eventId) {
      return { ok: true, eventId: remote.eventId, event: remote.event };
    }

    if (remote.alreadyActivated) {
      return { ok: false, error: 'Ticket già attivato.' };
    }

    return { ok: false, error: remote.error ?? 'Ticket non trovato.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Errore tecnico durante la risoluzione ticket.',
    };
  }
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

  // Enforce UUID only when Supabase-backed auth is active.
  if (isSupabaseConfigured && !UUID_PATTERN.test(normalizedUserId)) {
    return { ok: false, error: 'ID utente non valido.' };
  }

  if (isTicketHashActivatedInSession(normalizedHash)) {
    return { ok: false, error: 'Ticket già attivato in questa sessione.' };
  }

  try {
    const remote = await activateRemotely(normalizedHash, normalizedUserId);
    
    if (remote?.ok) {
      const currentRecord = localActivationStore.get(normalizedHash);
      localActivationStore.set(normalizedHash, {
        hash: normalizedHash,
        eventId: remote.eventId ?? currentRecord?.eventId ?? '',
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
    if (shouldLogActivationError(error)) {
      console.error('Remote activation failed:', error);
    }
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

  // Enforce UUID only when Supabase-backed auth is active.
  if (isSupabaseConfigured && !UUID_PATTERN.test(normalizedUserId)) {
    return { ok: false, error: 'ID utente non valido.' };
  }
  const manualTicketKey = buildManualTicketKey(normalizedEventId, normalizedTicket);
  if (localManualActivationStore.has(manualTicketKey)) {
    return { ok: false, error: 'Ticket già attivato in questa sessione.' };
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

    if (remote?.ok) {
      cleanupOldRecords();
      localManualActivationStore.set(manualTicketKey, {
        eventId: normalizedEventId,
        ticketNumber: normalizedTicket,
        activatedBy: normalizedUserId,
        activatedAtIso: new Date().toISOString(),
      });
      return { ok: true, eventId: remote.eventId, event: remote.event };
    }
    if (remote?.alreadyActivated) return { ok: false, error: 'Ticket già attivato.' };
    return { ok: false, error: remote?.error || 'Errore durante l\'attivazione manuale.' };
  } catch (error) {
    if (shouldLogActivationError(error)) {
      console.error('Manual activation failed:', error);
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Errore tecnico.' };
  }
}

// --- Issue #415: Client-side hash registration (inverted flow) ---

const ROME_OFFSET = '+01:00';
const OFFLINE_TICKET_QUEUE_KEY = 'tdp-mobile-ticket-queue-v1';

export type PendingTicketRegistration = {
  ticketNumber: string;
  eventID: string;
  circuit: string;
  clientHash: string;
  canonicalJson: string;
  queuedAt: string;
  retryCount: number;
};

export function buildEventDatetimeIso(eventDate: string, eventTime: string): string {
  const date = eventDate.trim();
  const time = eventTime.trim();
  const timeParts = time.split(':');
  const normalizedTime = timeParts.length === 2 ? `${time}:00` : time;
  return `${date}T${normalizedTime}${ROME_OFFSET}`;
}

export async function computeTicketHash(params: {
  circuit: string;
  eventName: string;
  eventID: string;
  ticketNumber: string;
  date: string;
}): Promise<{ hash: string; canonicalJson: string }> {
  const payload: TicketPayload = {
    circuit: params.circuit.trim(),
    eventName: params.eventName.trim(),
    eventID: params.eventID.trim(),
    ticketNumber: params.ticketNumber.trim(),
    date: params.date.trim(),
  };
  const canonicalJson = stableStringify(payload);
  const hash = await sha256Hex(canonicalJson);
  return { hash, canonicalJson };
}

export async function registerTicketByNumber(
  eventID: string,
  ticketNumber: string,
  userId: string,
  eventMeta?: { name: string; date: string; time: string },
  circuit = 'TicketOne'
): Promise<
  | { ok: true; eventId?: string; event?: ActivatedEventPayload; hash?: string; queued?: boolean }
  | { ok: false; error: string }
> {
  const normalizedEventId = eventID.trim();
  const normalizedTicket = ticketNumber.trim();
  const normalizedUserId = userId.trim();

  if (!normalizedEventId || !normalizedTicket || !normalizedUserId) {
    return { ok: false, error: 'Dati mancanti per la registrazione biglietto.' };
  }

  if (isSupabaseConfigured && !UUID_PATTERN.test(normalizedUserId)) {
    return { ok: false, error: 'ID utente non valido.' };
  }

  const manualTicketKey = buildManualTicketKey(normalizedEventId, normalizedTicket);
  if (localManualActivationStore.has(manualTicketKey)) {
    return { ok: false, error: 'Biglietto già registrato in questa sessione.' };
  }

  // Compute client-side hash if event metadata is available
  let clientHash = '';
  let canonicalJson = '';
  if (eventMeta) {
    const dateIso = buildEventDatetimeIso(eventMeta.date, eventMeta.time);
    const computed = await computeTicketHash({
      circuit,
      eventName: eventMeta.name,
      eventID: normalizedEventId,
      ticketNumber: normalizedTicket,
      date: dateIso,
    });
    clientHash = computed.hash;
    canonicalJson = computed.canonicalJson;
  }

  // Offline: queue for later sync
  if (!supabase || !isSupabaseConfigured || isNavigatorOffline()) {
    if (!clientHash) {
      return { ok: false, error: 'Impossibile registrare offline senza dati evento.' };
    }
    enqueueOfflineTicket({
      ticketNumber: normalizedTicket,
      eventID: normalizedEventId,
      circuit,
      clientHash,
      canonicalJson,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    });
    cleanupOldRecords();
    localManualActivationStore.set(manualTicketKey, {
      eventId: normalizedEventId,
      ticketNumber: normalizedTicket,
      activatedBy: normalizedUserId,
      activatedAtIso: new Date().toISOString(),
    });
    return { ok: true, eventId: normalizedEventId, hash: clientHash, queued: true };
  }

  try {
    const { data, error } = await invokeTicketActivation({
      action: 'register_ticket',
      payload: {
        eventID: normalizedEventId,
        ticketNumber: normalizedTicket,
        circuit,
        clientHash: clientHash || undefined,
      },
      userId: normalizedUserId,
    });

    if (error) {
      const errorMessage = await resolveFunctionErrorMessage(
        error,
        'Errore durante la registrazione del biglietto.'
      );
      throw new Error(errorMessage);
    }

    const remote = data as {
      ok?: boolean;
      alreadyActivated?: boolean;
      error?: string;
      eventId?: string;
      eventName?: string;
      hash?: string;
      event?: ActivatedEventPayload;
    } | null;

    if (remote?.ok) {
      cleanupOldRecords();
      localManualActivationStore.set(manualTicketKey, {
        eventId: normalizedEventId,
        ticketNumber: normalizedTicket,
        activatedBy: normalizedUserId,
        activatedAtIso: new Date().toISOString(),
      });
      return { ok: true, eventId: remote.eventId, event: remote.event, hash: remote.hash };
    }

    if (remote?.alreadyActivated) {
      return { ok: false, error: 'Questo biglietto è già stato utilizzato.' };
    }

    return { ok: false, error: remote?.error || 'Errore durante la registrazione biglietto.' };
  } catch (error) {
    if (shouldLogActivationError(error)) {
      console.error('Ticket registration failed:', error);
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Errore tecnico.' };
  }
}

// --- Offline ticket queue ---

function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

function readOfflineTicketQueue(): PendingTicketRegistration[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_TICKET_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineTicketQueue(queue: PendingTicketRegistration[]) {
  if (typeof window === 'undefined') return;
  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(OFFLINE_TICKET_QUEUE_KEY);
    } else {
      window.localStorage.setItem(OFFLINE_TICKET_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // ignore storage errors
  }
}

function enqueueOfflineTicket(entry: PendingTicketRegistration) {
  const queue = readOfflineTicketQueue();
  // Deduplicate by clientHash
  if (queue.some((item) => item.clientHash === entry.clientHash)) return;
  queue.push(entry);
  writeOfflineTicketQueue(queue);
}

export function getOfflineTicketQueueSize(): number {
  return readOfflineTicketQueue().length;
}

export async function flushOfflineTicketQueue(
  userId: string
): Promise<{ synced: number; failed: number }> {
  if (!supabase || !isSupabaseConfigured || isNavigatorOffline()) {
    return { synced: 0, failed: 0 };
  }

  const queue = readOfflineTicketQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const remaining: PendingTicketRegistration[] = [];
  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      const { data, error } = await invokeTicketActivation({
        action: 'register_ticket',
        payload: {
          eventID: entry.eventID,
          ticketNumber: entry.ticketNumber,
          circuit: entry.circuit,
          clientHash: entry.clientHash,
        },
        userId,
      });

      if (error) throw error;
      const remote = data as { ok?: boolean; alreadyActivated?: boolean } | null;
      if (remote?.ok || remote?.alreadyActivated) {
        synced++;
      } else {
        entry.retryCount++;
        if (entry.retryCount < 5) remaining.push(entry);
        else failed++;
      }
    } catch {
      entry.retryCount++;
      if (entry.retryCount < 5) remaining.push(entry);
      else failed++;
    }
  }

  writeOfflineTicketQueue(remaining);
  return { synced, failed };
}

export function listLocalTicketRecords(): TicketActivationRecord[] {
  return Array.from(localActivationStore.values()).sort((a, b) => a.hash.localeCompare(b.hash));
}
