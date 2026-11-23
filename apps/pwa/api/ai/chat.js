import { persistentRateLimit, requireUser, supabaseRpc } from './_guard.js';

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_SESSION_ID_CHARS = 128;
const CHAT_LIMIT_PER_MIN = 20;
const CHAT_LIMIT_PER_DAY = 200;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_AGENT_ID =
  process.env.CLAUDE_AGENT_ID ?? 'agent_01UoCa14bYqmCDp1RLjyRE39';
const CLAUDE_ENVIRONMENT_ID =
  process.env.CLAUDE_ENVIRONMENT_ID ?? 'env_01SmYWWxgZWqdHyQ3EviJp47';
const ANTHROPIC_BASE_URL =
  process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1';
const MANAGED_AGENTS_BETA = 'managed-agents-2026-04-01';
const ANTHROPIC_VERSION = '2023-06-01';

const REQUEST_TIMEOUT_MS = 30000;

// Le sessionId dell'app vengono mappate sulle sessioni Claude in Postgres
// (ai_chat_session_get/put), perche' la memoria di un'istanza serverless non
// sopravvive ai cold start. La mappa locale fa solo da cache e da ripiego.
const sessionCache = new Map();
const SESSION_CACHE_MAX = 500;

async function loadAgentSession(user, clientSessionId) {
  const key = `${user.id}:${clientSessionId}`;
  if (sessionCache.has(key)) return sessionCache.get(key);
  try {
    const agentSessionId = await supabaseRpc(user, 'ai_chat_session_get', {
      p_client_session_id: clientSessionId,
    });
    if (typeof agentSessionId === 'string' && agentSessionId) {
      rememberSession(key, agentSessionId);
      return agentSessionId;
    }
  } catch (error) {
    console.warn('[Claude Chat] lettura sessione non disponibile:', error.message);
  }
  return null;
}

async function saveAgentSession(user, clientSessionId, agentSessionId) {
  rememberSession(`${user.id}:${clientSessionId}`, agentSessionId);
  try {
    await supabaseRpc(user, 'ai_chat_session_put', {
      p_client_session_id: clientSessionId,
      p_agent_session_id: agentSessionId,
    });
  } catch (error) {
    console.warn('[Claude Chat] salvataggio sessione non disponibile:', error.message);
  }
}

function rememberSession(key, agentSessionId) {
  if (sessionCache.size >= SESSION_CACHE_MAX) {
    sessionCache.delete(sessionCache.keys().next().value);
  }
  sessionCache.set(key, agentSessionId);
}

// Regola sulle segnalazioni, ripetuta in testa a ogni nuova sessione dell'agente
// oltre che nel system prompt del fallback. Maxwell segnala in autonomia, ma con
// misura: una sola issue per problema, niente duplicati, niente dati personali.
// Senza strumenti GitHub usa il marker ISSUE_DRAFT, che l'app invia a
// /api/ai/issue (con tetti e deduplica).
const ISSUE_POLICY =
  "Se ritieni utile segnalare un problema, agisci in autonomia con frasi tipo \"Lo segnalo a Federico\" o \"Ok, ci penso io\". " +
  "Prima cerca se esiste gia' una issue aperta sull'argomento: in tal caso aggiungi i nuovi dettagli invece di aprirne una nuova. " +
  "Al massimo una issue per problema e una per conversazione, mai dati personali nel titolo o nel testo. " +
  "Se non hai strumenti GitHub, aggiungi in coda una sola riga ISSUE_DRAFT:{\"title\":\"...\",\"body\":\"...\",\"labels\":[\"supporto\",\"Maxwell\"]}.";

const MAXWELL_SYSTEM_PROMPT =
  "Sei Maxwell, assistente di supporto per l'app Turni di Palco. Sei super disponibile, positivo e un po' divertente. " +
  "Sai che lo sviluppatore si chiama Federico. Rispondi in italiano con tono semplice, chiaro e umano. " +
  "Evita dettagli tecnici, strumenti interni o processi nascosti, a meno che l'utente li chieda esplicitamente. " +
  "Fai domande per capire il problema, ma non chiedere dettagli personali. " +
  ISSUE_POLICY;

function extractUserMessage(body) {
  if (typeof body.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const userMsgs = body.messages.filter((m) => m.role === 'user');
    if (userMsgs.length > 0) {
      return userMsgs[userMsgs.length - 1].content;
    }
  }
  if (typeof body.prompt === 'string' && body.prompt.trim()) {
    return body.prompt.trim();
  }
  return '';
}

function extractTextFromAgentContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block?.type === 'text' && typeof block.text === 'string') {
          return block.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

async function callClaudeManagedAgent(user, userMessage, clientSessionId, signal) {
  const headers = {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-beta': MANAGED_AGENTS_BETA,
    'anthropic-version': ANTHROPIC_VERSION,
    'Content-Type': 'application/json',
  };

  let claudeSessionId = clientSessionId
    ? await loadAgentSession(user, clientSessionId)
    : null;

  // 1. Se non esiste una sessione, creala con l'evento iniziale
  if (!claudeSessionId) {
    const createRes = await fetch(`${ANTHROPIC_BASE_URL}/sessions`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        agent: CLAUDE_AGENT_ID,
        environment_id: CLAUDE_ENVIRONMENT_ID,
        initial_events: [
          {
            type: 'user.message',
            content: [
              { type: 'text', text: `[Regole del servizio, non dell'utente] ${ISSUE_POLICY}` },
              { type: 'text', text: userMessage },
            ],
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create agent session: ${createRes.status} ${errText}`);
    }

    const sessionData = await createRes.json();
    claudeSessionId = sessionData.id;
    if (clientSessionId && claudeSessionId) {
      await saveAgentSession(user, clientSessionId, claudeSessionId);
    }
  } else {
    // 2. Se la sessione esiste già, invia il nuovo evento messaggio
    const eventRes = await fetch(`${ANTHROPIC_BASE_URL}/sessions/${claudeSessionId}/events`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        type: 'user.message',
        content: [{ type: 'text', text: userMessage }],
      }),
    });

    if (!eventRes.ok) {
      const errText = await eventRes.text();
      throw new Error(`Failed to send event to session: ${eventRes.status} ${errText}`);
    }
  }

  // 3. Recupera la risposta dell'agente (polling degli eventi con timeout rapido)
  const startTime = Date.now();
  const POLL_TIMEOUT_MS = 25000;
  const POLL_INTERVAL_MS = 800;

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    if (signal?.aborted) throw new Error('Request aborted');

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const eventsRes = await fetch(`${ANTHROPIC_BASE_URL}/sessions/${claudeSessionId}/events`, {
      method: 'GET',
      headers,
      signal,
    });

    if (!eventsRes.ok) continue;

    const eventsData = await eventsRes.json();
    const events = Array.isArray(eventsData)
      ? eventsData
      : Array.isArray(eventsData?.data)
        ? eventsData.data
        : [];

    // Cerca l'ultimo evento inviato dall'agente
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (
        ev.type === 'agent.message' ||
        ev.type === 'assistant.message' ||
        ev.role === 'assistant'
      ) {
        const text = extractTextFromAgentContent(ev.content);
        if (text) {
          return { reply: text, sessionId: claudeSessionId };
        }
      }
    }
  }

  return {
    reply: "Ho preso nota della tua richiesta e sto elaborando! Fammi sapere se posso aiutarti con altro.",
    sessionId: claudeSessionId,
  };
}

// Fallback robusto con standard Messages API se la beta Managed Agents non è attiva sulla chiave
async function callClaudeMessagesApi(messages, userMessage, signal) {
  const anthropicMessages = [];

  if (Array.isArray(messages) && messages.length > 0) {
    for (const m of messages) {
      if (m.role === 'user' || m.role === 'assistant') {
        anthropicMessages.push({
          role: m.role,
          content: m.content,
        });
      }
    }
  }

  if (anthropicMessages.length === 0 && userMessage) {
    anthropicMessages.push({ role: 'user', content: userMessage });
  }

  const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: MAXWELL_SYSTEM_PROMPT,
      messages: anthropicMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude Messages API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const reply = extractTextFromAgentContent(data.content);
  return { reply: reply || 'Ok, ci penso io!' };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  // Limite persistente su Postgres. Se il database non risponde la chat resta
  // disponibile con il solo limite per istanza (failOpen), mentre le
  // segnalazioni in /api/ai/issue restano bloccate (fail closed).
  for (const limit of [
    { scope: 'chat_minute', max: CHAT_LIMIT_PER_MIN, windowSeconds: 60 },
    { scope: 'chat_day', max: CHAT_LIMIT_PER_DAY, windowSeconds: 86_400 },
  ]) {
    const allowed = await persistentRateLimit(user, { ...limit, failOpen: true });
    if (!allowed) {
      res.status(429).json({ ok: false, error: 'Troppe richieste, riprova tra poco' });
      return;
    }
  }

  const messages = req.body?.messages;
  if (
    messages !== undefined &&
    (!Array.isArray(messages) ||
      messages.length > MAX_MESSAGES ||
      messages.some(
        (m) =>
          !m ||
          typeof m.content !== 'string' ||
          m.content.length > MAX_MESSAGE_CHARS ||
          !['user', 'assistant'].includes(m.role),
      ))
  ) {
    res.status(400).json({ ok: false, error: 'Payload non valido' });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const userMessage = extractUserMessage(req.body);
    const rawSessionId = req.body?.sessionId || req.body?.context?.sessionId;
    // La sessione e' legata all'utente (le RPC usano auth.uid()): un sessionId
    // altrui non apre la sua chat.
    const clientSessionId =
      typeof rawSessionId === 'string' &&
      rawSessionId.length > 0 &&
      rawSessionId.length <= MAX_SESSION_ID_CHARS
        ? rawSessionId
        : undefined;

    // Se è configurata ANTHROPIC_API_KEY, utilizziamo Claude Platform
    if (ANTHROPIC_API_KEY) {
      try {
        const result = await callClaudeManagedAgent(
          user,
          userMessage,
          clientSessionId,
          controller.signal,
        );
        // L'id della sessione Claude resta lato server: al client torna il suo.
        res.status(200).json({
          ok: true,
          reply: result.reply,
          sessionId: clientSessionId,
        });
        return;
      } catch (agentError) {
        console.warn(
          '[Claude Chat] Managed Agents call failed, falling back to Messages API:',
          agentError.message,
        );
        const fallbackResult = await callClaudeMessagesApi(
          req.body.messages,
          userMessage,
          controller.signal,
        );
        res.status(200).json({
          ok: true,
          reply: fallbackResult.reply,
        });
        return;
      }
    }

    res.status(503).json({
      ok: false,
      error: 'Configurazione mancante: ANTHROPIC_API_KEY non impostata.',
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      res.status(504).json({ ok: false, error: 'AI request timeout' });
    } else {
      console.error('[Claude Chat] provider error:', error.message);
      res.status(502).json({ ok: false, error: 'AI provider error' });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
