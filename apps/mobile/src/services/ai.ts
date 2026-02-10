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

const DEFAULT_PORT = import.meta.env.VITE_AI_SUPPORT_PORT ?? '8787';
const DEFAULT_ENDPOINT =
  import.meta.env.VITE_AI_SUPPORT_ENDPOINT ?? buildDefaultEndpoint('/api/ai/chat');
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
  return `${protocol}//${host}:${DEFAULT_PORT}${path}`;
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
    return endpoint.replace(/\/api\/ai\/chat\/?$/, '/health');
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

export async function requestAiSupport({
  userName,
  memory,
  messages,
  endpoint,
  signal,
}: AiSupportRequest) {
  return withMobileWatchdog(async () => {
    const target = resolveEndpoint(endpoint);
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
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
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

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
      window.clearTimeout(timeout);
    }
  }, {
    operation: 'checkAiSupportAvailability',
    timeoutMs: watchdogTimeoutMs,
    title: 'Verifica supporto rallentata',
    message: 'Il controllo disponibilita del supporto sta richiedendo troppo tempo.',
  });
}

export async function requestAiIssue({
  payload,
  endpoint,
}: {
  payload: AiSupportIssuePayload;
  endpoint?: string;
}) {
  return withMobileWatchdog(async () => {
    const target = resolveIssueEndpoint(endpoint);
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
}
