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

const SUPPORT_PROMPT =
  "Sei un assistente di supporto automatizzato per l'app Turni di Palco. " +
  "Rispondi in italiano con tono semplice e cordiale. " +
  "Evita dettagli tecnici, strumenti o processi interni. " +
  "Fai domande di chiarimento quando serve. " +
  "Se l'utente porta dettagli tecnici, puoi rispondere in modo piu' tecnico. " +
  "Se per risolvere serve aprire una segnalazione, chiedi conferma e riassumi il problema in modo breve.";

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
  const target = endpoint ?? import.meta.env.VITE_AI_SUPPORT_ENDPOINT ?? '/api/ai/chat';
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
