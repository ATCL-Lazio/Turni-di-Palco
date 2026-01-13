import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Send } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { Textarea } from '../ui/textarea';
import {
  requestAiIssue,
  requestAiSupport,
  type AiChatMessage,
} from '../../services/ai';

type SupportMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt: number;
};

type IssueDraft = {
  title: string;
  body: string;
  labels?: string[];
};

type ChatSession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: SupportMessage[];
};

interface SupportChatProps {
  userName: string;
  onBack: () => void;
}

function buildMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const HISTORY_KEY_PREFIX = 'tdp-maxwell-history:';
const MAX_SESSIONS = 10;
const MAX_MESSAGES_PER_SESSION = 120;
const ISSUE_DRAFT_MARKER = 'ISSUE_DRAFT:';

function buildSupportMessage(role: SupportMessage['role'], content: string) {
  return {
    id: buildMessageId(),
    role,
    content,
    createdAt: Date.now(),
  };
}

function buildGreetingMessage(displayName: string) {
  return buildSupportMessage(
    'assistant',
    `Ciao ${displayName}! Sono Maxwell, pronto a darti una mano. Come posso aiutarti?`
  );
}

function getHistoryKey(displayName: string) {
  const base = displayName.trim().toLowerCase().replace(/\s+/g, '-');
  return `${HISTORY_KEY_PREFIX}${base || 'utente'}`;
}

function loadChatHistory(displayName: string): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getHistoryKey(displayName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((session) => ({
        id: String(session.id),
        createdAt: Number(session.createdAt) || Date.now(),
        updatedAt: Number(session.updatedAt) || Date.now(),
        messages: Array.isArray(session.messages) ? session.messages : [],
      }))
      .filter((session) => session.id && session.messages.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function saveChatHistory(displayName: string, sessions: ChatSession[]) {
  if (typeof window === 'undefined') return;
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  const trimmed = sorted.slice(0, MAX_SESSIONS);
  try {
    window.localStorage.setItem(
      getHistoryKey(displayName),
      JSON.stringify(trimmed)
    );
  } catch {
    // ignore quota/security errors
  }
}

function trimMessages(messages: SupportMessage[]) {
  if (messages.length <= MAX_MESSAGES_PER_SESSION) return messages;
  return messages.slice(messages.length - MAX_MESSAGES_PER_SESSION);
}

function updateSessionList(
  sessions: ChatSession[],
  sessionId: string,
  messages: SupportMessage[]
) {
  const now = Date.now();
  let found = false;
  const next = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    found = true;
    return {
      ...session,
      updatedAt: now,
      messages: trimMessages(messages),
    };
  });
  if (!found) {
    next.unshift({
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      messages: trimMessages(messages),
    });
  }
  return next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
}

function formatSessionDate(timestamp: number) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildSessionPreview(session: ChatSession) {
  const lastMessage = [...session.messages].reverse().find(Boolean);
  if (!lastMessage) return 'Conversazione vuota';
  const prefix = lastMessage.role === 'user' ? 'Tu: ' : 'Maxwell: ';
  const text = lastMessage.content.trim();
  return `${prefix}${text.length > 80 ? `${text.slice(0, 77)}...` : text}`;
}

function buildMemorySnippet(sessions: ChatSession[], activeSessionId: string) {
  const lines: string[] = [];
  const candidates = sessions
    .filter((session) => session.id !== activeSessionId)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  for (const session of candidates) {
    for (const message of session.messages.slice(-6)) {
      const who = message.role === 'user' ? 'Utente' : 'Maxwell';
      const trimmed = message.content.replace(/\s+/g, ' ').trim();
      lines.push(
        `${who}: ${
          trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed
        }`
      );
      if (lines.length >= 8) break;
    }
    if (lines.length >= 8) break;
  }

  return lines.length ? lines.join('\n') : '';
}

function extractIssueDraft(reply: string) {
  const markerIndex = reply.indexOf(ISSUE_DRAFT_MARKER);
  if (markerIndex === -1) {
    return { text: reply.trim(), draft: null };
  }

  const before = reply.slice(0, markerIndex).trim();
  const raw = reply.slice(markerIndex + ISSUE_DRAFT_MARKER.length).trim();
  if (!raw) {
    return { text: before || reply.trim(), draft: null };
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.title !== 'string' || typeof parsed?.body !== 'string') {
      return { text: before || reply.trim(), draft: null };
    }
    const labels = Array.isArray(parsed.labels)
      ? parsed.labels.map((label) => String(label))
      : undefined;
    const text = before || 'Ok, ci penso io!';
    return {
      text,
      draft: {
        title: parsed.title.trim(),
        body: parsed.body.trim(),
        labels,
      },
    };
  } catch {
    return { text: before || reply.trim(), draft: null };
  }
}

export function SupportChat({ userName, onBack }: SupportChatProps) {
  const displayName = userName || 'Utente';
  const greetingMessage = useMemo(
    () => buildGreetingMessage(displayName),
    [displayName]
  );
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const issueTrackerRef = useRef(new Set<string>());

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  useEffect(() => {
    const stored = loadChatHistory(displayName);
    if (stored.length) {
      setChatSessions(stored);
      setActiveSessionId(stored[0].id);
      setMessages(stored[0].messages);
    } else {
      const sessionId = buildMessageId();
      const session: ChatSession = {
        id: sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [greetingMessage],
      };
      setChatSessions([session]);
      setActiveSessionId(sessionId);
      setMessages(session.messages);
      saveChatHistory(displayName, [session]);
    }
    hasLoadedRef.current = true;
  }, [displayName, greetingMessage]);

  useEffect(() => {
    if (!hasLoadedRef.current || !activeSessionId) return;
    setChatSessions((prev) => {
      const next = updateSessionList(prev, activeSessionId, messages);
      saveChatHistory(displayName, next);
      return next;
    });
  }, [messages, activeSessionId, displayName]);

  const hasInput = input.trim().length > 0;

  const buildChatPayload = (nextMessages: SupportMessage[]): AiChatMessage[] => {
    const base: AiChatMessage = {
      role: 'system',
      content:
        "Supporto Maxwell per utenti finali. Linguaggio semplice, umano e positivo. " +
        "Evita dettagli tecnici se non richiesti.",
    };
    const history: AiChatMessage[] = nextMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    return [base, ...history];
  };

  const handleIssueDraft = async (draft: IssueDraft) => {
    if (isCreatingIssue) return;
    const signature = `${draft.title}::${draft.body}`;
    if (issueTrackerRef.current.has(signature)) return;
    issueTrackerRef.current.add(signature);
    setIsCreatingIssue(true);
    try {
      await requestAiIssue({ payload: draft });
    } catch {
      // Nessun dettaglio tecnico in chat: Maxwell gestisce in autonomia.
    } finally {
      setIsCreatingIssue(false);
    }
  };

  const handleSend = async () => {
    if (!hasInput || isLoading) return;
    const content = input.trim();
    setInput('');
    setErrorMessage(null);

    const userMessage = buildSupportMessage('user', content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const memory = buildMemorySnippet(chatSessions, activeSessionId);
      const reply = await requestAiSupport({
        userName: displayName,
        memory,
        messages: buildChatPayload(nextMessages),
      });
      const { text, draft } = extractIssueDraft(reply);
      if (draft) {
        void handleIssueDraft(draft);
      }
      const displayText = text || (draft ? 'Ok, ci penso io!' : reply);
      setMessages((prev) => [
        ...prev,
        buildSupportMessage('assistant', displayText),
      ]);
    } catch {
      const fallback =
        "Il supporto automatizzato non e' disponibile in questo momento. Riprova tra poco.";
      setErrorMessage(fallback);
      setMessages((prev) => [
        ...prev,
        buildSupportMessage('assistant', fallback),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    const session = chatSessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setIsHistoryOpen(false);
  };

  const handleNewSession = () => {
    const sessionId = buildMessageId();
    const session: ChatSession = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [buildGreetingMessage(displayName)],
    };
    const next = [session, ...chatSessions].slice(0, MAX_SESSIONS);
    setChatSessions(next);
    setActiveSessionId(sessionId);
    setMessages(session.messages);
    saveChatHistory(displayName, next);
    setIsHistoryOpen(false);
  };

  return (
    <Screen
      withBottomNavPadding={false}
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+20px)] space-y-0 box-border"
    >
      <div className="flex h-full w-full flex-col gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
              Supporto
            </p>
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className="text-[12px] leading-[18px] text-[#f4bf4f] border border-[#2d2728] rounded-[999px] px-3 py-1"
              aria-pressed={isHistoryOpen}
            >
              Cronologia chat
            </button>
          </div>
          <div className="flex items-center gap-2 text-[13px] leading-[18px] text-[#b8b2b3]">
            <Bot className="text-[#f4bf4f]" size={16} />
            <span>Chat con Maxwell</span>
          </div>
          <p className="text-[14px] leading-[20px] text-[#7a7577]">
            Maxwell ti aiuta a risolvere problemi e a semplificarti la vita.
          </p>
        </div>

        {isHistoryOpen ? (
          <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[14px] leading-[20px] text-white font-semibold">
                Cronologia chat
              </p>
              <button
                type="button"
                onClick={handleNewSession}
                className="text-[12px] leading-[18px] text-[#f4bf4f]"
              >
                Nuova chat
              </button>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {chatSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleSelectSession(session.id)}
                  className="w-full text-left bg-[#0f0d0e] border border-[#2d2728] rounded-[12px] px-3 py-2"
                >
                  <div className="text-[12px] leading-[18px] text-white">
                    {formatSessionDate(session.updatedAt)}
                  </div>
                  <div className="text-[11px] leading-[16px] text-[#b8b2b3]">
                    {buildSessionPreview(session)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-[16.4px] px-4 py-3 text-[14px] leading-[20px] ${
                  message.role === 'user'
                    ? 'bg-[#2d0a0f] text-white'
                    : 'bg-[#1a1617] text-white'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-[16.4px] px-4 py-3 text-[14px] leading-[20px] bg-[#1a1617] text-[#b8b2b3]">
                Sto scrivendo...
              </div>
            </div>
          ) : null}
          {errorMessage ? (
            <p className="text-[12px] leading-[18px] text-[#ff4d4f]">{errorMessage}</p>
          ) : null}
          <div ref={scrollRef} />
        </div>

        <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-3 flex items-end gap-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Scrivi qui il tuo messaggio..."
            rows={2}
            className="bg-[#0f0d0e] border-[#2d2728] text-white text-[14px] leading-[20px]"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!hasInput || isLoading}
            className="flex items-center justify-center size-[44px] rounded-[14px] bg-gradient-to-b from-[#8c1c38] to-[#a82847] text-white disabled:opacity-60"
            aria-label="Invia"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </Screen>
  );
}
