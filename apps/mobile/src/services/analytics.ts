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
 * Hash veloce non-crittografico (FNV-1a 32-bit). Sufficiente per de-anonimizzare
 * gli eventi senza esporre l'userId. Non usare per scopi di sicurezza.
 */
function fnv1aHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

let cachedHash: string | null = null;
let cachedHashSource: string | null = null;

export function getUserHash(userId: string | null | undefined): string | undefined {
  if (!userId) return undefined;
  if (cachedHashSource === userId && cachedHash) return cachedHash;
  cachedHash = fnv1aHash(userId);
  cachedHashSource = userId;
  return cachedHash;
}

/**
 * Strip di chiavi PII potenziali dalle props. Per ora drop preventivo
 * di pattern noti; le proprietà permesse sono valori scalari "neutri".
 */
const FORBIDDEN_KEYS = new Set([
  'email', 'name', 'userName', 'firstName', 'lastName',
  'address', 'phone', 'token', 'password', 'session',
]);

function sanitizeProps(
  props?: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  let any = false;
  for (const [k, v] of Object.entries(props)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = v;
    any = true;
  }
  return any ? out : undefined;
}

export function track(
  event: AnalyticsEventName,
  options?: {
    userId?: string | null;
    props?: Record<string, string | number | boolean | null>;
  },
): void {
  if (!readConsent()) return;

  const payload: AnalyticsEventPayload = {
    event,
    userHash: getUserHash(options?.userId ?? null),
    props: sanitizeProps(options?.props),
    ts: new Date().toISOString(),
  };

  try {
    const result = currentSink(payload);
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => { /* swallow — analytics never breaks UX */ });
    }
  } catch {
    /* swallow — analytics never breaks UX */
  }
}

// ---------------------------------------------------------------------------
// Helper di alto livello per gli eventi più comuni. Tipizzati per evitare
// di sparpagliare letterali ovunque e per centralizzare le `props`.
// ---------------------------------------------------------------------------

export function trackSessionStart(userId?: string | null): void {
  track('session_start', { userId });
}

export function trackOnboardingStarted(userId?: string | null): void {
  track('onboarding_started', { userId });
}

export function trackOnboardingCompleted(
  userId: string | null | undefined,
  variant: 'full' | 'skipped_qr' | 'skipped_manual',
): void {
  track('onboarding_completed', { userId, props: { variant } });
}

export function trackFirstScenarioCompleted(
  userId: string | null | undefined,
  sceneId: string,
): void {
  track('first_scenario_completed', { userId, props: { sceneId } });
}

export function trackActivityCompleted(
  userId: string | null | undefined,
  props: { activityId: string; rating: string; score: number; durationMs: number },
): void {
  track('activity_completed', { userId, props });
}

export function trackTurnRegistered(
  userId: string | null | undefined,
  props: { theatreHash: string; boostRequested: boolean; boostApplied: boolean },
): void {
  track('turn_registered', { userId, props });
}

export function trackShareClicked(
  userId: string | null | undefined,
  surface: 'profile' | 'turn_certified' | 'level_up' | 'badge',
  outcome: 'shared' | 'copied' | 'cancelled' | 'unsupported' | 'error',
): void {
  track('share_clicked', { userId, props: { surface, outcome } });
}
