import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type QrVerificationSuccess = {
  ok: true;
  eventId: string;
  source: 'edge' | 'fixed' | 'legacy';
};

export type QrVerificationFailure = {
  ok: false;
  error: string;
};

export type QrVerificationResult = QrVerificationSuccess | QrVerificationFailure;

const FALLBACK_FIXED_CODE = 'ATCL-TEST-FIXED';

function resolveFallbackEventId(eventIds: string[]) {
  return eventIds[0] ?? 'ATCL-001';
}

function verifyLocalFallback(code: string, eventIds: string[]): QrVerificationResult {
  const fallbackEventId = resolveFallbackEventId(eventIds);
  if (code === FALLBACK_FIXED_CODE) {
    return { ok: true, eventId: fallbackEventId, source: 'fixed' };
  }

  if (!import.meta.env.DEV || isSupabaseConfigured) {
    return { ok: false, error: 'QR non valido.' };
  }

  const legacyEvent = eventIds.find((id) => code.toLowerCase().includes(id.toLowerCase()));
  if (legacyEvent) {
    return { ok: true, eventId: legacyEvent, source: 'legacy' };
  }

  return { ok: false, error: 'QR non valido.' };
}

export async function verifyQrCode(code: string, eventIds: string[]): Promise<QrVerificationResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, error: 'QR non valido.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return verifyLocalFallback(trimmed, eventIds);
  }

  const fallbackEventId = resolveFallbackEventId(eventIds);
  
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    const supabasePromise = supabase.functions.invoke('verify-qr-mock', {
      body: {
        code: trimmed,
        fallbackEventId,
      },
    });

    const { data, error } = await Promise.race([supabasePromise, timeoutPromise]) as any;

    if (error) {
      console.warn('Supabase QR verification failed, using fallback:', error);
      return verifyLocalFallback(trimmed, eventIds);
    }

    if (!data || typeof data !== 'object') {
      return verifyLocalFallback(trimmed, eventIds);
    }

    const payload = data as {
      ok?: boolean;
      eventId?: unknown;
      error?: unknown;
    };

    if (!payload.ok) {
      const message = typeof payload.error === 'string' ? payload.error : 'QR non valido.';
      return { ok: false, error: message };
    }

    if (typeof payload.eventId !== 'string' || !payload.eventId) {
      return verifyLocalFallback(trimmed, eventIds);
    }

    return { ok: true, eventId: payload.eventId, source: 'edge' };
  } catch (error) {
    console.warn('QR verification error, using fallback:', error);
    return verifyLocalFallback(trimmed, eventIds);
  }
}
