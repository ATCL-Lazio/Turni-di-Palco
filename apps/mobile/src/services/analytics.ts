// KPI tracking minimo, privacy-friendly. Closes #477.
//
// Principi:
// - Nessun PII (no email, no nome, no userId in chiaro). Gli ID utente sono
//   hashati prima di lasciare il client.
// - Gating sul consenso cookie: senza consenso, nessun evento viene inviato.
// - Per i minori 14-17 (target del gioco) il consenso genitoriale è regolato a
//   monte; questo modulo si limita a rispettare la flag `analytics_consent`.
// - Lo storage degli eventi è un sink pluggabile: di default un endpoint
//   Supabase Edge Function, ma in dev/test scrive su `console.debug`.
//
// Pseudonimizzazione (issue #1086):
// - L'hashing degli userId è delegato alla Edge Function `pseudonymize-user-id`.
// - Il salt `ANALYTICS_SALT` è un secret server-side: non è mai incluso nel
//   bundle JS distribuito ai client.
// - Il client invia l'userId all'Edge Function via HTTPS con JWT autenticato
//   e riceve in cambio soltanto l'hash (stringa hex HMAC-SHA256). Il salt non
//   lascia mai il server Supabase.
//
// Eventi tracciati (lista chiusa, no eventi free-form):
//   - session_start
//   - onboarding_started
//   - onboarding_completed
//   - first_scenario_completed (conversione installa → primo scenario)
//   - activity_completed
//   - turn_registered
//   - share_clicked

import { COOKIE_CONSENT_KEY } from '../constants/privacy';

export const ANALYTICS_CONSENT_KEY = 'tdp-analytics-consent';

export type AnalyticsEventName =
  | 'session_start'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'first_scenario_completed'
  | 'activity_completed'
  | 'turn_registered'
  | 'share_clicked';

export type AnalyticsEventPayload = {
  /** Evento. */
  event: AnalyticsEventName;
  /** Hash stabile dell'userId; mai userId in chiaro. */
  userHash?: string;
  /** Properties opzionali; non possono contenere PII. */
  props?: Record<string, string | number | boolean | null>;
  /** Timestamp ISO. */
  ts: string;
};

export type AnalyticsSink = (event: AnalyticsEventPayload) => void | Promise<void>;

let currentSink: AnalyticsSink = (event) => {
  // Default sink in dev/preview: scrive su console e nient'altro.
  //
  // TODO(production): in `AppShell.tsx` (o equivalente bootstrap), DOPO
  // aver verificato il consenso analytics, chiamare `setAnalyticsSink`
  // con l'implementazione di produzione (Plausible custom-event endpoint
  // o Supabase Edge Function `ingest-analytics`). Senza override gli
  // eventi sono solo loggati e mai persistiti.
  if (typeof console !== 'undefined') {
    console.debug('[analytics]', event.event, event.props ?? {});
  }
};

export function setAnalyticsSink(sink: AnalyticsSink): void {
  currentSink = sink;
}

/**
 * Install the production sink that persists events to the `ingest-analytics`
 * Edge Function (issues #321 / #164). No-op transport when the Supabase URL is
 * unknown; never throws (analytics must never break UX). Auth is attached from
 * the token set via {@link setAnalyticsAuthToken}.
 *
 * Idempotent: calling it again simply re-registers the same sink.
 */
export function installIngestAnalyticsSink(): void {
  setAnalyticsSink(async (event) => {
    const supabaseUrl = _supabaseUrl;
    if (!supabaseUrl || supabaseUrl.length === 0) return;
    const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ingest-analytics`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        // Let the request outlive a page-hide (e.g. session_start on unload).
        keepalive: true,
      });
    } catch {
      /* network error / function not deployed — degrade gracefully */
    }
  });
}

function readConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Doppio gate: cookie consent generale (valore = ISO timestamp di accettazione,
    // vedi CookieConsent.tsx) + opt-in specifico analytics.
    const cookieOk = Boolean(window.localStorage.getItem(COOKIE_CONSENT_KEY));
    const analyticsOk = window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'granted';
    return cookieOk && analyticsOk;
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    /* quota exceeded — degrade gracefully */
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent();
}

// ---------------------------------------------------------------------------
// Auth token management
//
// Il consumer (AppShell) chiama `setAnalyticsAuthToken` dopo ogni cambio di
// sessione Supabase per fornire il JWT corrente. Il token viene incluso nelle
// richieste all'Edge Function `pseudonymize-user-id` come Authorization header.
// Al logout il consumer chiama `setAnalyticsAuthToken(null)`.
// ---------------------------------------------------------------------------

let _authToken: string | null = null;

/**
 * Imposta il JWT Supabase dell'utente corrente da usare nelle chiamate
 * all'Edge Function di pseudonimizzazione. Chiamare con `null` al logout.
 */
export function setAnalyticsAuthToken(token: string | null): void {
  _authToken = token;
}

// ---------------------------------------------------------------------------
// Supabase URL — configurable for testing
//
// In produzione l'URL viene letto da `import.meta.env.VITE_SUPABASE_URL` (valore
// iniettato da Vite al build time). Nei test è possibile sovrascriverlo via
// `setAnalyticsSupabaseUrl` per evitare dipendenze da `vi.stubEnv`, che non
// aggiorna `import.meta.env` in modo affidabile in tutti gli ambienti CI.
// ---------------------------------------------------------------------------

let _supabaseUrl: string | null =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL ?? null;

/**
 * Imposta l'URL base di Supabase usato dall'Edge Function di pseudonimizzazione.
 * Utile nei test per iniettare un URL fittizio senza ricorrere a `vi.stubEnv`.
 * Chiamare con `null` per ripristinare il comportamento di default (nessun hash).
 */
export function setAnalyticsSupabaseUrl(url: string | null): void {
  _supabaseUrl = url;
}

// ---------------------------------------------------------------------------
// Hash cache
//
// La cache è un'ottimizzazione: un userId → una sola chiamata HTTP all'Edge
// Function per sessione. In una PWA mono-utente questo è trascurabile, ma se
// si supportano switch d'account senza reload vogliamo che i vecchi hash non
// restino in memoria.
//
// Strategie:
//   1. Limite hard di MAX_CACHE_ENTRIES per evitare crescita illimitata.
//   2. `clearAnalyticsCache()` esposta come hook che il code path di logout /
//      account switch può chiamare esplicitamente.
// ---------------------------------------------------------------------------

const MAX_CACHE_ENTRIES = 16;
const hashCache = new Map<string, Promise<string | undefined>>();

export function clearAnalyticsCache(): void {
  hashCache.clear();
}

/**
 * Restituisce l'hash pseudonimizzato dell'userId via Edge Function Supabase.
 *
 * Il salt `ANALYTICS_SALT` è un secret server-side configurato su Supabase
 * (`supabase secrets set ANALYTICS_SALT=<value>`) e non è mai incluso nel
 * bundle JS distribuito ai client. La Edge Function `pseudonymize-user-id`
 * esegue HMAC-SHA256(ANALYTICS_SALT, userId) lato server e restituisce solo
 * il digest hex — la pseudonimizzazione è GDPR-grade (issue #1086).
 *
 * L'hash è deterministico (stesso userId → stesso hash) e viene cachato in
 * memoria per tutta la sessione. Al logout, chiamare `clearAnalyticsCache()`
 * per rimuovere gli hash in memoria.
 *
 * Se la fetch fallisce o `VITE_SUPABASE_URL` non è configurato, restituisce
 * `undefined` — gli eventi analitici vengono inviati senza `userHash` invece
 * di interrompere l'UX.
 */
export function getUserHash(userId: string | null | undefined): Promise<string | undefined> {
  if (!userId) return Promise.resolve(undefined);

  let pending = hashCache.get(userId);
  if (!pending) {
    if (hashCache.size >= MAX_CACHE_ENTRIES) {
      // LRU eviction: Map preserva l'ordine di inserimento, quindi la prima
      // chiave è la meno recente. Evictiamo solo quella invece di un wipe
      // completo, così switch d'account multipli non causano burst di richieste
      // HTTP su utenti ancora attivi nella tab.
      const oldest = hashCache.keys().next().value;
      if (oldest !== undefined) hashCache.delete(oldest);
    }
    // Cache the promise immediately to deduplicate concurrent calls for the
    // same userId. However, if the fetch resolves to `undefined` (network
    // error, 401 before auth token is available, etc.) we evict the entry so
    // that a future call — after the token is set — can retry successfully.
    pending = fetchUserHash(userId).then((hash) => {
      if (hash === undefined) hashCache.delete(userId);
      return hash;
    });
    hashCache.set(userId, pending);
  }
  return pending;
}

/**
 * Chiama l'Edge Function `pseudonymize-user-id` per ottenere l'hash HMAC-SHA256
 * dell'userId. Restituisce `undefined` in caso di errore (never throws).
 */
async function fetchUserHash(userId: string): Promise<string | undefined> {
  try {
    const supabaseUrl = _supabaseUrl;

    if (!supabaseUrl || supabaseUrl.length === 0) {
      return undefined;
    }

    const edgeFnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/pseudonymize-user-id`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (_authToken) {
      headers['Authorization'] = `Bearer ${_authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(edgeFnUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // Log solo in dev per non inquinare la produzione con warning non
      // actionable (es. utente non autenticato non ha ancora il token).
      const env = (import.meta as { env?: Record<string, string | undefined> }).env;
      if (env?.DEV) {
        console.warn(
          `[analytics] pseudonymize-user-id responded ${response.status} — userHash omitted.`,
        );
      }
      return undefined;
    }

    const data = await response.json() as { hash?: string };
    if (typeof data.hash === 'string' && data.hash.length > 0) {
      return data.hash;
    }
    return undefined;
  } catch {
    // Network error, Edge Function not deployed, etc. — degrade gracefully.
    return undefined;
  }
}

/**
 * Allowlist (NON blocklist) delle property ammesse negli eventi.
 *
 * Una blocklist è fragile: ogni nuova chiave che il chiamante decide di
 * passare arriva nel sink per default, e se per errore una chiave PII
 * non è in lista (es. `userId`, `id`, `user_id`) viene leakata in chiaro.
 * Invertiamo la logica: solo chiavi esplicitamente registrate qui passano
 * il filtro, le altre vengono droppate silenziosamente.
 *
 * Per aggiungere una property nuova:
 *   1. Verifica che NON contenga PII (mai userId, mai email, ecc.).
 *   2. Aggiungi la chiave qui.
 *   3. Aggiorna il tipo di chiamata corrispondente (es. `trackActivityCompleted`).
 */
const ALLOWED_PROP_KEYS = new Set([
  // share_clicked
  'surface', 'outcome',
  // onboarding_completed
  'variant',
  // first_scenario_completed / activity_completed
  'sceneId', 'activityId', 'rating', 'score', 'durationMs',
  // turn_registered
  'theatreHash', 'boostRequested', 'boostApplied',
]);

function sanitizeProps(
  props?: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  let any = false;
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED_PROP_KEYS.has(k)) continue;
    out[k] = v;
    any = true;
  }
  return any ? out : undefined;
}

export async function track(
  event: AnalyticsEventName,
  options?: {
    userId?: string | null;
    props?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  if (!readConsent()) return;

  const userHash = await getUserHash(options?.userId ?? null);
  const payload: AnalyticsEventPayload = {
    event,
    userHash,
    props: sanitizeProps(options?.props),
    ts: new Date().toISOString(),
  };

  try {
    // `Promise.resolve(...)` accetta valori sync, Promise native e thenable
    // custom in modo uniforme; più robusto del duck-typing su `.catch`.
    await Promise.resolve(currentSink(payload)).catch(() => {
      /* swallow — analytics never breaks UX */
    });
  } catch {
    /* swallow — analytics never breaks UX */
  }
}

// ---------------------------------------------------------------------------
// Helper di alto livello per gli eventi più comuni. Tipizzati per evitare
// di sparpagliare letterali ovunque e per centralizzare le `props`.
// ---------------------------------------------------------------------------

export function trackSessionStart(userId?: string | null): Promise<void> {
  return track('session_start', { userId });
}

export function trackOnboardingStarted(userId?: string | null): Promise<void> {
  return track('onboarding_started', { userId });
}

export function trackOnboardingCompleted(
  userId: string | null | undefined,
  variant: 'full' | 'skipped_qr' | 'skipped_manual',
): Promise<void> {
  return track('onboarding_completed', { userId, props: { variant } });
}

export function trackFirstScenarioCompleted(
  userId: string | null | undefined,
  sceneId: string,
): Promise<void> {
  return track('first_scenario_completed', { userId, props: { sceneId } });
}

export function trackActivityCompleted(
  userId: string | null | undefined,
  props: { activityId: string; rating: string; score: number; durationMs: number },
): Promise<void> {
  return track('activity_completed', { userId, props });
}

export function trackTurnRegistered(
  userId: string | null | undefined,
  props: { theatreHash: string; boostRequested: boolean; boostApplied: boolean },
): Promise<void> {
  return track('turn_registered', { userId, props });
}

export function trackShareClicked(
  userId: string | null | undefined,
  surface: 'profile' | 'turn_certified' | 'level_up' | 'badge',
  outcome: 'shared' | 'copied' | 'cancelled' | 'unsupported' | 'error',
): Promise<void> {
  return track('share_clicked', { userId, props: { surface, outcome } });
}
