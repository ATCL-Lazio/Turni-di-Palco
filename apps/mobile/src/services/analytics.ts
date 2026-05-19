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
  if (typeof console !== 'undefined') {
    console.debug('[analytics]', event.event, event.props ?? {});
  }
};

export function setAnalyticsSink(sink: AnalyticsSink): void {
  currentSink = sink;
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

/**
 * Pseudonimizzazione dell'userId: SHA-256 + salt iniettato a build time
 * (`VITE_ANALYTICS_SALT`).
 *
 * **Limite noto**: `VITE_*` è una variabile Vite, viene embeddata nel bundle
 * JS e distribuita a tutti i client — NON è un secret server-side. Questo
 * livello di pseudonimizzazione protegge da chi guarda solo gli eventi
 * analitici (no PII visibile), ma un attaccante che (a) recupera il bundle
 * della PWA e (b) conosce un set di Supabase UUID può ricalcolare gli hash
 * corrispondenti. Per pseudonimizzazione GDPR-grade, l'hashing va spostato
 * lato Supabase Edge Function con un secret che non lascia mai il server.
 *
 * Se il salt non è configurato, ritorniamo `undefined` invece di un hash
 * non-salted: meglio perdere il join cross-event che dare una finta
 * pseudonimizzazione.
 */
async function pseudonymize(userId: string, salt: string): Promise<string | undefined> {
  if (typeof crypto === 'undefined' || !crypto.subtle?.digest) return undefined;
  const encoded = new TextEncoder().encode(`${salt}:${userId}`);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function readSalt(): string | null {
  // Vite expone `import.meta.env` solo al bundling; in test/SSR fallback su
  // process.env per dare flessibilità.
  try {
    const fromVite = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ANALYTICS_SALT;
    if (typeof fromVite === 'string' && fromVite.length > 0) return fromVite;
  } catch {
    /* import.meta.env not available */
  }
  if (typeof process !== 'undefined' && process.env?.VITE_ANALYTICS_SALT) {
    return process.env.VITE_ANALYTICS_SALT;
  }
  return null;
}

// La cache è un'ottimizzazione (un userId → una sola digest async). Le chiavi
// sono raw UUID Supabase: in una PWA mono-utente questo è trascurabile, ma se
// si supportano switch d'account senza reload — o si chiudono/aprono profili
// diversi nella stessa tab — vogliamo che i vecchi UUID non restino in memoria.
//
// Strategie:
//   1. Limite hard di MAX_CACHE_ENTRIES per evitare crescita illimitata.
//   2. `clearAnalyticsCache()` esposta come hook che il code path di logout /
//      account switch può chiamare esplicitamente.
const MAX_CACHE_ENTRIES = 16;
const hashCache = new Map<string, Promise<string | undefined>>();

export function clearAnalyticsCache(): void {
  hashCache.clear();
}

export function getUserHash(userId: string | null | undefined): Promise<string | undefined> {
  if (!userId) return Promise.resolve(undefined);
  const salt = readSalt();
  if (!salt) return Promise.resolve(undefined);
  let pending = hashCache.get(userId);
  if (!pending) {
    if (hashCache.size >= MAX_CACHE_ENTRIES) hashCache.clear();
    pending = pseudonymize(userId, salt);
    hashCache.set(userId, pending);
  }
  return pending;
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
    const result = currentSink(payload);
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      await (result as Promise<unknown>).catch(() => { /* swallow — analytics never breaks UX */ });
    }
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
