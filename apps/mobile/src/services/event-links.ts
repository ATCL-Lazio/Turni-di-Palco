import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { extractEventIdFromPayload, normalizeEventId } from '../lib/event-linking';

type ValidateQrResponse = {
  valid: boolean;
  eventId?: string;
  error?: string;
};

async function invokeEventLinks(payload: Record<string, unknown>) {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke('event-links', {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || 'Errore durante la chiamata backend.');
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
