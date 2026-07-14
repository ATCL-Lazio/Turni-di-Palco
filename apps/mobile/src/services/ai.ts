import { withMobileWatchdog } from './mobile-watchdog';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AiSupportRequest = {
  userName?: string;
  memory?: string;
  messages: AiChatMessage[];
  endpoint?: string;
  signal?: AbortSignal;
};

type AiSupportResponse = {
  reply?: string;
  message?: string;
  content?: string;
  text?: string;
  choices?: Array<{ message?: { content?: string } }>;
};

type AiSupportIssuePayload = {
  title: string;
  body: string;
  labels?: string[];
};

type AiSupportIssueResponse = {
  url?: string | null;
  output?: string;
  existing?: boolean;
  action?: string;
};

type AiSupportAvailabilityOptions = {
  endpoint?: string;
  timeoutMs?: number;
};

export type AiSupportAvailabilityStatus =
  | 'available'
  | 'unavailable'
  | 'unknown';

const SUPPORT_PROMPT =
  "Sei Maxwell, assistente di supporto per l'app Turni di Palco. " +
  "Sei super disponibile, positivo e un po' divertente. " +
  "Sai che lo sviluppatore si chiama Federico. " +
  "Rispondi in italiano con tono semplice, chiaro e umano. " +
  "Evita dettagli tecnici, strumenti interni o processi nascosti, a meno che l'utente li chieda esplicitamente. " +
  "Fai domande per capire il problema, ma non chiedere dettagli per compilare segnalazioni. " +
  "Se ritieni utile segnalarlo, agisci in autonomia e usa frasi tipo \"Lo segnalo a Federico\" o \"Ok, ci penso io\". " +
  "Quando decidi di segnalarlo, aggiungi in coda una riga con ISSUE_DRAFT:{\"title\":\"...\",\"body\":\"...\",\"labels\":[\"supporto\",\"Maxwell\"]}. " +
  "Non citare il marker o il JSON nel testo per l'utente: lascia la spiegazione sopra al marker. " +
  "Non ripetere il saluto iniziale se e' gia' presente nella chat.";

const FALLBACK_PORT = '8787';
const DEFAULT_PORT = import.meta.env.VITE_AI_SUPPORT_PORT ?? FALLBACK_PORT;
// On non-localhost deployments always route through the same-origin Vercel proxy
// (/api/ai/chat) to avoid CORS issues, regardless of VITE_AI_SUPPORT_ENDPOINT.
const DEFAULT_ENDPOINT = (() => {
  const configured = import.meta.env.VITE_AI_SUPPORT_ENDPOINT;
  if (
    configured &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return buildDefaultEndpoint('/api/ai/chat');
  }
  return configured ?? buildDefaultEndpoint('/api/ai/chat');
})();
const DEFAULT_ISSUE_ENDPOINT =
  import.meta.env.VITE_AI_SUPPORT_ISSUE_ENDPOINT ?? null;
const AI_SUPPORT_REQUEST_WATCHDOG_MS = 25000;
const AI_ISSUE_REQUEST_WATCHDOG_MS = 20000;
const AI_AVAILABILITY_WATCHDOG_MIN_MS = 5000;
const AI_AVAILABILITY_WATCHDOG_BUFFER_MS = 1500;

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function resolveEndpoint(override?: string) {
  return normalizeEndpoint(override ?? DEFAULT_ENDPOINT);
}

function buildDefaultEndpoint(path: string) {
  if (typeof window === 'undefined') {
    return path;
  }
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname || 'localhost';
  // Only append the dev port on loopback hosts. On a deployed origin the
  // Maxwell server lives on a separate host, and appending :8787 to a
  // managed-platform domain (e.g. *.onrender.com) makes the request
  // unreachable. Callers must set VITE_AI_SUPPORT_ENDPOINT in production.
  if (isLocalHost(host) && DEFAULT_PORT) {
    return `${protocol}//${host}:${DEFAULT_PORT}${path}`;
  }
  return `${protocol}//${host}${path}`;
}

function normalizeEndpoint(endpoint: string) {
  if (!endpoint || typeof window === 'undefined') {
    return endpoint;
  }

  if (!endpoint.includes('://') && endpoint.startsWith('/')) {
    return buildDefaultEndpoint(endpoint);
  }

  try {
    const url = new URL(endpoint);
    const currentHost = window.location.hostname;
    const currentIsLocal = isLocalHost(currentHost);
    if (
      currentHost &&
      !currentIsLocal &&
      isLocalHost(url.hostname)
    ) {
      url.hostname = currentHost;
      url.port = ''; // clear localhost port when rewriting to production host
      if (window.location.protocol === 'https:') {
        url.protocol = 'https:';
      }
    }
    if (!url.port && DEFAULT_PORT && isLocalHost(url.hostname)) {
      url.port = DEFAULT_PORT;
    }
    return url.toString();
  } catch {
    return endpoint;
  }
}

function resolveIssueEndpoint(override?: string) {
  if (override) return normalizeEndpoint(override);
  if (DEFAULT_ISSUE_ENDPOINT) return normalizeEndpoint(DEFAULT_ISSUE_ENDPOINT);
  const base = resolveEndpoint();
  if (base.includes('/api/ai/chat')) {
    return base.replace(/\/api\/ai\/chat\/?$/, '/api/ai/issue');
  }
  return normalizeEndpoint('/api/ai/issue');
}

function resolveHealthEndpoint(endpoint: string) {
  if (endpoint.includes('/api/ai/chat')) {
    return endpoint.replace(/\/api\/ai\/chat\/?$/, '/api/ai/health');
  }
  return endpoint;
}

function extractReply(payload: AiSupportResponse | string | null) {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload.reply === 'string') return payload.reply;
  if (typeof payload.message === 'string') return payload.message;
  if (typeof payload.content === 'string') return payload.content;
  if (typeof payload.text === 'string') return payload.text;
  const choice = payload.choices?.[0]?.message?.content;
  if (typeof choice === 'string') return choice;
  return null;
}

/** Returns the resolved Maxwell chat endpoint URL (respects VITE_AI_SUPPORT_ENDPOINT). */
export function resolveAiChatEndpoint(override?: string): string {
  return resolveEndpoint(override);
}

export async function requestAiSupport({
  userName,
  memory,
  messages,
  endpoint,
  signal,
}: AiSupportRequest) {
  // Use a single AbortController driven by withMobileWatchdog's timeout so that
  // the inner fetch() is aborted when the 25-second watchdog fires, preventing
  // the request from dangling in the background (mirrors requestAiIssue pattern).
  const controller = new AbortController();

  // Combine the watchdog controller signal with any externally supplied signal.
  const combinedSignal = (() => {
    if (!signal) return controller.signal;
    const merged = new AbortController();
    if (controller.signal.aborted || signal.aborted) {
      merged.abort();
    } else {
      const abort = () => merged.abort();
      controller.signal.addEventListener('abort', abort, { once: true });
      signal.addEventListener('abort', abort, { once: true });
    }
    return merged.signal;
  })();

  try {
    return await withMobileWatchdog(async () => {
      const target = resolveEndpoint(endpoint);
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: combinedSignal,
        body: JSON.stringify({
          prompt: SUPPORT_PROMPT,
          messages,
          context: {
            userName,
            memory,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || 'AI request failed');
      }

      const data = (await response.json()) as AiSupportResponse;
      const reply = extractReply(data);
      if (!reply) {
        throw new Error('Missing AI reply');
      }
      return reply;
    }, {
      operation: 'requestAiSupport',
      timeoutMs: AI_SUPPORT_REQUEST_WATCHDOG_MS,
      title: 'Supporto rallentato',
      message: 'Il servizio di supporto sta impiegando troppo tempo a rispondere.',
    });
  } catch (error) {
    controller.abort();
    throw error;
  }
}

export async function checkAiSupportAvailability({
  endpoint,
  timeoutMs = 2500,
}: AiSupportAvailabilityOptions = {}) {
  const watchdogTimeoutMs = Math.max(
    AI_AVAILABILITY_WATCHDOG_MIN_MS,
    timeoutMs + AI_AVAILABILITY_WATCHDOG_BUFFER_MS
  );
  return withMobileWatchdog(async () => {
    const target = resolveHealthEndpoint(resolveEndpoint(endpoint));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(target, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
      });
      return response.ok ? 'available' : 'unavailable';
    } catch {
      return 'unknown';
    } finally {
      clearTimeout(timeout);
    }
  }, {
    operation: 'checkAiSupportAvailability',
    timeoutMs: watchdogTimeoutMs,
    title: 'Verifica supporto rallentata',
    message: 'Il controllo disponibilita del supporto sta richiedendo troppo tempo.',
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rimuove i dati personali più comuni da un testo prima che finisca in un
 * canale potenzialmente pubblico (le segnalazioni di Maxwell diventano issue
 * GitHub sul repo pubblico). Copre email, numeri di telefono e codice fiscale
 * italiano; `extraTerms` consente di rimuovere termini noti aggiuntivi come il
 * nome dell'utente. Tutela dei minori + GDPR Art. 32: una segnalazione non deve
 * esporre PII. La funzione è deterministica e non lancia mai.
 */
export function redactPII(text: string, extraTerms: string[] = []): string {
  if (!text) return text;
  let out = text;
  // Email.
  out = out.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[email rimossa]',
  );
  // Codice fiscale italiano (16 caratteri) — prima dei numeri di telefono.
  out = out.replace(
    /\b[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]\b/g,
    '[dato rimosso]',
  );
  // Numeri di telefono: prefisso internazionale opzionale e cifre (8–15) con
  // eventuali separatori. Il filtro sul conteggio cifre evita di rovinare
  // numeri innocui (es. "livello 100", "score 1500").
  out = out.replace(
    /(?:\+|00)?\d[\d\s().-]{6,}\d/g,
    (match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 15 ? '[telefono rimosso]' : match;
    },
  );
  // Termini noti aggiuntivi (es. il nome utente). Ignora stringhe cortissime
  // per non redigere in modo troppo aggressivo.
  for (const term of extraTerms) {
    const trimmed = term?.trim();
    if (!trimmed || trimmed.length < 3) continue;
    out = out.replace(new RegExp(escapeRegExp(trimmed), 'gi'), '[nome rimosso]');
  }
  return out;
}

export async function requestAiIssue({
  payload,
  endpoint,
}: {
  payload: AiSupportIssuePayload;
  endpoint?: string;
}) {
  // Rete di sicurezza: redige PII dal draft indipendentemente dal chiamante,
  // prima che diventi una issue pubblica.
  const safePayload: AiSupportIssuePayload = {
    ...payload,
    title: redactPII(payload.title),
    body: redactPII(payload.body),
  };
  // Use a single AbortController driven by withMobileWatchdog's timeout.
  // A redundant window.setTimeout at the same interval would create a race
  // where the outer abort fires after withMobileWatchdog already resolved,
  // surfacing a false watchdog error banner (closes #1239).
  const controller = new AbortController();
  try {
    return await withMobileWatchdog(async () => {
      const target = resolveIssueEndpoint(endpoint);
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(safePayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || 'Issue request failed');
      }

      return (await response.json()) as AiSupportIssueResponse;
    }, {
      operation: 'requestAiIssue',
      timeoutMs: AI_ISSUE_REQUEST_WATCHDOG_MS,
      title: 'Segnalazione rallentata',
      message: 'L invio della segnalazione sta impiegando troppo tempo.',
    });
  } catch (error) {
    controller.abort();
    throw error;
  }
}
