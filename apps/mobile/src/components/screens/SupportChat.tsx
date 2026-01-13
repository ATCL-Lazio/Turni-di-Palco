import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Send } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { Textarea } from '../ui/textarea';
import { requestAiSupport, type AiChatMessage } from '../../services/ai';

type SupportMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

interface SupportChatProps {
  userName: string;
  onBack: () => void;
}

function buildMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SupportChat({ userName, onBack }: SupportChatProps) {
  const displayName = userName || 'Utente';
  const greeting = useMemo(
    () => `Ciao ${displayName}, sono Maxwell. Come posso aiutarti?`,
    [displayName]
  );
  const [messages, setMessages] = useState<SupportMessage[]>([
    { id: buildMessageId(), role: 'assistant', content: greeting },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const hasInput = input.trim().length > 0;

  const buildChatPayload = (nextMessages: SupportMessage[]): AiChatMessage[] => {
    const base: AiChatMessage = {
      role: 'system',
      content:
        "Supporto automatizzato per utenti finali. Usa un linguaggio semplice e fluido. " +
        "Non parlare di strumenti tecnici o processi interni se non richiesto dall'utente.",
    };
    const history: AiChatMessage[] = nextMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    return [base, ...history];
  };

  const handleSend = async () => {
    if (!hasInput || isLoading) return;
    const content = input.trim();
    setInput('');
    setErrorMessage(null);

    const userMessage: SupportMessage = {
      id: buildMessageId(),
      role: 'user',
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const reply = await requestAiSupport({
        userName: displayName,
        messages: buildChatPayload(nextMessages),
      });
      setMessages((prev) => [
        ...prev,
        { id: buildMessageId(), role: 'assistant', content: reply },
      ]);
    } catch {
      const fallback =
        "Il supporto automatizzato non e' disponibile in questo momento. Riprova tra poco.";
      setErrorMessage(fallback);
      setMessages((prev) => [
        ...prev,
        { id: buildMessageId(), role: 'assistant', content: fallback },
      ]);
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-[#f5f5f5]">
            Supporto
          </p>
          <div className="flex items-center gap-2 text-[13px] leading-[18px] text-[#b8b2b3]">
            <Bot className="text-[#f4bf4f]" size={16} />
            <span>Chat con Maxwell</span>
          </div>
          <p className="text-[14px] leading-[20px] text-[#7a7577]">
            Maxwell ti aiuta a risolvere problemi e richieste comuni.
          </p>
        </div>

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
