import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { extractEventIdFromPayload, normalizeEventId } from '../lib/event-linking';

type ValidateQrResponse = {
  valid: boolean;
  eventId?: string;
  error?: string;
};

async function resolveFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const candidate = error as {
    message?: unknown;
    context?: {
      status?: number;
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
      clone?: () => unknown;
    };
  };

  let message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
  const context = candidate.context;

  if (context && typeof context === 'object') {
    const cloneFn = typeof context.clone === 'function' ? context.clone.bind(context) : null;
    const source = cloneFn ? (cloneFn() as typeof context) : context;

    if (source && typeof source.json === 'function') {
      try {
        const body = await source.json();
        if (body && typeof body === 'object') {
          const payload = body as { error?: unknown; message?: unknown };
          const bodyMessage =
            (typeof payload.error === 'string' && payload.error.trim()) ||
            (typeof payload.message === 'string' && payload.message.trim()) ||
            '';
          if (bodyMessage) {
            return bodyMessage;
          }
        }
      } catch {
        // fall back to text/message below
      }
    }

    const sourceForText = cloneFn ? (cloneFn() as typeof context) : context;
    if (sourceForText && typeof sourceForText.text === 'function') {
      try {
        const text = (await sourceForText.text()).trim();
        if (text) {
          return text;
        }
      } catch {
        // ignore and continue fallback
      }
    }

    if (typeof context.status === 'number' && context.status > 0) {
      if (message) {
        return `HTTP ${context.status}: ${message}`;
      }
      return `HTTP ${context.status}: ${fallback}`;
    }
  }

  if (!message || /non-2xx/i.test(message)) {
    return fallback;
  }

  return message;
}

async function invokeEventLinks(payload: Record<string, unknown>) {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke('event-links', {
    body: payload,
  });

  if (error) {
    const errorMessage = await resolveFunctionErrorMessage(
      error,
      'Errore durante la chiamata backend.'
    );
    throw new Error(errorMessage);
  }

  return data as Record<string, unknown>;
}

export async function validateQrPayload(code: string, knownEventIds: string[]): Promise<ValidateQrResponse> {
  const extracted = extractEventIdFromPayload(code);
  if (!extracted) {
    return { valid: false, error: 'QR non valido.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const data = await invokeEventLinks({ action: 'validate_qr', qrPayload: code });
      if (data) {
        return {
          valid: Boolean(data.valid),
          eventId: typeof data.eventId === 'string' ? normalizeEventId(data.eventId) : extracted,
          error: typeof data.error === 'string' ? data.error : undefined,
        };
      }
    } catch {
      // fallback to local matching
    }
  }

  const matched = knownEventIds.find((id) => id.toLowerCase() === extracted.toLowerCase());
  if (!matched) {
    return { valid: false, eventId: extracted, error: 'Evento non trovato.' };
  }

  return { valid: true, eventId: matched };
}
