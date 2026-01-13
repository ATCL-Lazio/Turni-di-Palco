export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AiSupportRequest = {
  userName?: string;
  messages: AiChatMessage[];
  endpoint?: string;
};

type AiSupportResponse = {
  reply?: string;
  message?: string;
  content?: string;
  text?: string;
  choices?: Array<{ message?: { content?: string } }>;
};

type AiSupportAvailabilityOptions = {
  endpoint?: string;
  timeoutMs?: number;
};

const SUPPORT_PROMPT =
  "Sei Maxwell, assistente di supporto automatizzato per l'app Turni di Palco. " +
  "Obiettivo: aiutare l'utente a risolvere problemi, capire le funzioni e fornire supporto. " +
  "Rispondi in italiano con tono semplice, chiaro e cordiale. " +
  "Evita dettagli tecnici, strumenti interni o processi nascosti, a meno che l'utente li chieda esplicitamente. " +
  "Fai domande di chiarimento quando serve e proponi passi brevi e concreti. " +
  "Se l'utente porta dettagli tecnici, puoi rispondere in modo piu' tecnico. " +
  "Se per risolvere serve aprire una segnalazione, chiedi prima il consenso e riassumi in 2-3 righe. " +
  "Non ripetere il saluto iniziale se e' gia' presente nella chat.";

const DEFAULT_ENDPOINT =
  import.meta.env.VITE_AI_SUPPORT_ENDPOINT ?? '/api/ai/chat';

function resolveEndpoint(override?: string) {
  return override ?? DEFAULT_ENDPOINT;
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
  messages,
  endpoint,
}: AiSupportRequest) {
  const target = resolveEndpoint(endpoint);
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: SUPPORT_PROMPT,
      messages,
      context: {
        userName,
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
}

export async function checkAiSupportAvailability({
  endpoint,
  timeoutMs = 2500,
}: AiSupportAvailabilityOptions = {}) {
  const target = resolveHealthEndpoint(resolveEndpoint(endpoint));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
