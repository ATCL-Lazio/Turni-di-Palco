import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Clock3,
  History,
  Loader2,
  Plus,
  Send,
  User,
} from 'lucide-react';
import { Screen } from '../ui/Screen';
import { Textarea } from '../ui/textarea';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import { Skeleton } from '../ui/skeleton';
import { useIsMobile } from '../ui/use-mobile';
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

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const isMobile = useIsMobile();
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
  const activeSession = useMemo(
    () => chatSessions.find((session) => session.id === activeSessionId) ?? null,
    [chatSessions, activeSessionId]
  );

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
      contentClassName="relative flex min-h-0 w-full flex-1 flex-col box-border px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,_0px)+16px)] md:px-6 md:pt-8"
    >
      <Drawer
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        direction={isMobile ? 'bottom' : 'right'}
      >
        <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col gap-4 min-h-0">
          <Card className="border border-[#2d2728] bg-gradient-to-b from-[#241f20] to-[#1a1617] p-4 md:p-5">
            <div className="flex items-start gap-3 md:gap-4">
              <button
                type="button"
                onClick={onBack}
                className="flex size-[44px] shrink-0 items-center justify-center rounded-xl border border-[#2d2728] bg-[#0f0d0e] text-[#f4bf4f] transition-colors hover:bg-[#241f20]"
                aria-label="Torna indietro"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#b8b2b3]">
                      Supporto intelligente
                    </p>
                    <h1 className="text-[25px] font-bold leading-[30px] text-[#f5f5f5]">
                      Maxwell
                    </h1>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsHistoryOpen(true)}
                    className="h-[40px] rounded-xl border border-[#3b3436] px-3 text-[#f4bf4f]"
                    aria-label={`Apri cronologia chat, ${chatSessions.length} sessioni`}
                  >
                    <History size={16} />
                    Cronologia
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                  <Badge variant="success" size="sm">
                    <span className="size-1.5 rounded-full bg-[#52c41a]" />
                    Maxwell online
                  </Badge>
                  {isLoading ? (
                    <Badge variant="default" size="sm">
                      <Loader2 size={12} className="animate-spin" />
                      Risposta in corso
                    </Badge>
                  ) : null}
                  {isCreatingIssue ? (
                    <Badge variant="outline" size="sm">
                      <Clock3 size={12} />
                      Segnalazione in preparazione
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[13px] leading-[19px] text-[#7a7577]">
                  Descrivi il problema con parole semplici. Maxwell ti risponde e,
                  se serve, prepara automaticamente una segnalazione.
                </p>
              </div>
            </div>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col border border-[#2d2728] bg-[#120f10] p-0">
            <div className="border-b border-[#2d2728] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#b8b2b3]">
                <span className="inline-flex items-center gap-1.5 text-[#f4bf4f]">
                  <Bot size={14} />
                  Chat attiva
                </span>
                {activeSession ? (
                  <span className="inline-flex items-center gap-1 text-[#7a7577]">
                    <Clock3 size={12} />
                    Aggiornata: {formatSessionDate(activeSession.updatedAt)}
                  </span>
                ) : null}
              </div>
            </div>

            <ScrollArea
              className="min-h-0 flex-1 px-3 py-4 md:px-4"
              aria-label="Messaggi chat Maxwell"
            >
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <article
                      className={`max-w-[88%] rounded-2xl border px-3 py-2.5 md:max-w-[78%] ${
                        message.role === 'user'
                          ? 'border-[#7f2038] bg-gradient-to-b from-[#8c1c38] to-[#6b1529] text-white'
                          : 'border-[#2d2728] bg-[#1a1617] text-white'
                      }`}
                      aria-label={message.role === 'user' ? 'Messaggio utente' : 'Messaggio Maxwell'}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          {message.role === 'user' ? (
                            <User size={12} />
                          ) : (
                            <Bot size={12} />
                          )}
                          {message.role === 'user' ? 'Tu' : 'Maxwell'}
                        </span>
                        <span className="inline-flex items-center gap-1 opacity-80">
                          <Clock3 size={11} />
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[14px] leading-[20px]">
                        {message.content}
                      </p>
                    </article>
                  </div>
                ))}

                {isLoading ? (
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-2xl border border-[#2d2728] bg-[#1a1617] px-3 py-3 md:max-w-[78%]">
                      <div className="mb-2 inline-flex items-center gap-2 text-[12px] text-[#b8b2b3]">
                        <Loader2 size={12} className="animate-spin" />
                        Maxwell sta scrivendo...
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-2.5 w-40 bg-[#2d2728]" />
                        <Skeleton className="h-2.5 w-28 bg-[#2d2728]" />
                      </div>
                    </div>
                  </div>
                ) : null}

                {errorMessage ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#ff4d4f]/40 bg-[#ff4d4f]/10 px-3 py-2 text-[12px] leading-[18px] text-[#ffd8d8]"
                  >
                    {errorMessage}
                  </div>
                ) : null}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          </Card>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom,_0px)+2px)]">
            <Card className="border border-[#2d2728] bg-[#1a1617]/95 p-3 backdrop-blur md:p-4">
              <div className="flex items-end gap-3">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Scrivi il tuo messaggio..."
                  rows={2}
                  aria-label="Scrivi un messaggio per Maxwell"
                  className="max-h-40 min-h-[56px] bg-[#0f0d0e] text-[14px] leading-[20px] text-white border-[#2d2728] pr-4"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={!hasInput || isLoading}
                  aria-label={isLoading ? 'Invio in corso' : 'Invia messaggio'}
                  className="h-[44px] min-w-[44px] rounded-[14px] px-3"
                >
                  {isLoading ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                  <span className="hidden md:inline">
                    {isLoading ? 'Invio...' : 'Invia'}
                  </span>
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7a7577]">
                <span>Invio: Enter - Nuova riga: Shift + Enter</span>
                {isCreatingIssue ? (
                  <span className="text-[#f4bf4f]">Segnalazione automatica in corso</span>
                ) : null}
              </div>
            </Card>
          </div>
        </div>

        <DrawerContent className="border-[#2d2728] bg-[#120f10] text-white data-[vaul-drawer-direction=bottom]:max-h-[82vh] data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:max-w-[420px]">
          <DrawerHeader className="border-b border-[#2d2728]">
            <DrawerTitle className="text-left text-[18px] text-white">
              Cronologia chat
            </DrawerTitle>
            <DrawerDescription className="text-left text-[#b8b2b3]">
              Riprendi una conversazione oppure apri una nuova sessione.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pt-3">
            <Button
              type="button"
              onClick={handleNewSession}
              className="h-[44px] w-full rounded-xl"
              aria-label="Inizia una nuova chat con Maxwell"
            >
              <Plus size={16} />
              Nuova chat
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4 py-3" aria-label="Lista cronologia chat">
            <div className="space-y-2 pr-1">
              {chatSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleSelectSession(session.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'border-[#a82847] bg-[#2d0a0f]/60'
                        : 'border-[#2d2728] bg-[#1a1617] hover:bg-[#241f20]'
                    }`}
                    aria-pressed={isActive}
                    aria-label={`Apri sessione del ${formatSessionDate(session.updatedAt)}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] leading-[18px] text-[#f4bf4f]">
                        {formatSessionDate(session.updatedAt)}
                      </span>
                      {isActive ? (
                        <span className="rounded-full border border-[#a82847] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#f4bf4f]">
                          Attiva
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-[18px] text-[#b8b2b3]">
                      {buildSessionPreview(session)}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <DrawerFooter className="border-t border-[#2d2728]">
            <DrawerClose asChild>
              <Button type="button" variant="ghost" className="h-[42px] rounded-xl">
                Chiudi
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Screen>
  );
}
