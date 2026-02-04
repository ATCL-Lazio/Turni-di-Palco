import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIXED_CODE = Deno.env.get('QR_MOCK_FIXED_CODE') ?? 'ATCL-TEST-FIXED';
const SIGNED_PREFIX = 'ATCL-MOCK';
const SIGNED_CODE_TTL_SECONDS = 10 * 60;
const ALLOWED_FUTURE_SKEW_SECONDS = 60;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;

type VerifyBody = {
  code?: unknown;
  fallbackEventId?: unknown;
};

type SignedToken = {
  eventId: string;
  issuedAt: number;
  nonce: string;
  signature: string;
};

type LogStatus = 'accepted' | 'rejected';
type LogSource = 'fixed' | 'hmac';

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function lowerCaseHex(value: string) {
  return value.trim().toLowerCase();
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

async function hmacSha256Hex(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toHex(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function parseSignedToken(code: string): SignedToken | null {
  if (typeof code !== 'string' || code.length === 0) return null;

  const parts = code.split(':');
  if (parts.length !== 5) return null;

  const [prefix, eventId, issuedAtRaw, nonce, signature] = parts;

  if (!prefix || !eventId || !issuedAtRaw || !nonce || !signature) return null;
  if (prefix !== SIGNED_PREFIX) return null;

  if (eventId.length > 100 || eventId.length === 0) return null;
  if (!NONCE_PATTERN.test(nonce)) return null;
  if (signature.length !== 64) return null;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return null;

  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + ALLOWED_FUTURE_SKEW_SECONDS) return null;
  if (issuedAt < now - SIGNED_CODE_TTL_SECONDS) return null;

  return {
    eventId: eventId.trim(),
    issuedAt: Math.floor(issuedAt),
    nonce: nonce.trim(),
    signature: lowerCaseHex(signature.trim()),
  };
}

async function resolveEventId(
  adminClient: ReturnType<typeof createClient>,
  candidate?: string,
  allowFallback = false
) {
  const preferred = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
  if (preferred) {
    const { data } = await adminClient
      .from('events')
      .select('id')
      .eq('id', preferred)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  if (!allowFallback) return null;

  const { data } = await adminClient.from('events').select('id').order('id', { ascending: true }).limit(1).maybeSingle();
  return data?.id ? (data.id as string) : null;
}

async function logAttempt(
  adminClient: ReturnType<typeof createClient>,
  params: {
    userId: string;
    eventId: string | null;
    source: LogSource;
    status: LogStatus;
    reason?: string;
    codeHash?: string;
  }
) {
  const { error } = await adminClient.from('qr_validation_logs').insert({
    user_id: params.userId,
    event_id: params.eventId,
    source: params.source,
    status: params.status,
    reason: params.reason ?? null,
    code_hash: params.codeHash ?? null,
  });

  if (error) {
    console.warn('qr_validation_logs insert failed', error.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Metodo non consentito.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const qrSecret = Deno.env.get('QR_MOCK_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, error: 'Configurazione Supabase non valida.' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ ok: false, error: 'Login richiesto.' }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await authClient.auth.getUser();
  const userId = authData?.user?.id ?? null;
  if (authError || !userId) {
    return jsonResponse({ ok: false, error: 'Login richiesto.' }, 401);
  }

  let body: VerifyBody = {};
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    body = {};
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return jsonResponse({ ok: false, error: 'QR non valido.' }, 400);
  }

  const codeHash = await sha256Hex(code);

  if (code === FIXED_CODE) {
    const eventId = await resolveEventId(
      adminClient,
      typeof body.fallbackEventId === 'string' ? body.fallbackEventId : undefined,
      true
    );
    if (!eventId) {
      await logAttempt(adminClient, {
        userId,
        eventId: null,
        source: 'fixed',
        status: 'rejected',
        reason: 'event_not_found',
        codeHash,
      });
      return jsonResponse({ ok: false, error: 'Evento mock non disponibile.' }, 400);
    }

    await logAttempt(adminClient, {
      userId,
      eventId,
      source: 'fixed',
      status: 'accepted',
      codeHash,
    });
    return jsonResponse({ ok: true, eventId, source: 'fixed' }, 200);
  }

  const parsed = parseSignedToken(code);
  if (!parsed) {
    await logAttempt(adminClient, {
      userId,
      eventId: null,
      source: 'hmac',
      status: 'rejected',
      reason: 'invalid_format',
      codeHash,
    });
    return jsonResponse({ ok: false, error: 'QR non valido.' }, 400);
  }

  if (!NONCE_PATTERN.test(parsed.nonce)) {
    await logAttempt(adminClient, {
      userId,
      eventId: parsed.eventId,
      source: 'hmac',
      status: 'rejected',
      reason: 'invalid_nonce',
      codeHash,
    });
    return jsonResponse({ ok: false, error: 'QR non valido.' }, 400);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (parsed.issuedAt > nowSeconds + ALLOWED_FUTURE_SKEW_SECONDS) {
    await logAttempt(adminClient, {
      userId,
      eventId: parsed.eventId,
      source: 'hmac',
      status: 'rejected',
      reason: 'issued_at_in_future',
      codeHash,
    });
    return jsonResponse({ ok: false, error: 'QR non valido.' }, 400);
  }

  if (nowSeconds - parsed.issuedAt > SIGNED_CODE_TTL_SECONDS) {
    await logAttempt(adminClient, {
      userId,
      eventId: parsed.eventId,
      source: 'hmac',
      status: 'rejected',
      reason: 'expired',
      codeHash,
    });
    return jsonResponse({ ok: false, error: 'QR scaduto. Richiedi un nuovo codice.' }, 400);
  }

  const eventId = await resolveEventId(adminClient, parsed.eventId, false);
  if (!eventId) {
    await logAttempt(adminClient, {
      userId,
      eventId: parsed.eventId,
      source: 'hmac',
      status: 'rejected',
      reason: 'event_not_found',
      codeHash,
    });
    return jsonResponse({ ok: false, error: 'Evento non valido.' }, 400);
  }

  if (!qrSecret) {
    return jsonResponse({ ok: false, error: 'Configurazione QR non disponibile.' }, 500);
  }

  const expectedSignature = await hmacSha256Hex(
    `${eventId}.${parsed.issuedAt}.${parsed.nonce}`,
    qrSecret
  );
  if (!timingSafeEqual(expectedSignature, parsed.signature)) {
    await logAttempt(adminClient, {
      userId,
      eventId,
      source: 'hmac',
      status: 'rejected',
      reason: 'invalid_signature',
      codeHash,
    });
    return jsonResponse({ ok: false, error: 'QR non valido.' }, 400);
  }

  const nonceInsert = await adminClient.from('qr_validation_nonces').insert({
    nonce: parsed.nonce,
    event_id: eventId,
    user_id: userId,
    issued_at: new Date(parsed.issuedAt * 1000).toISOString(),
    expires_at: new Date((parsed.issuedAt + SIGNED_CODE_TTL_SECONDS) * 1000).toISOString(),
  });

  if (nonceInsert.error) {
    if (nonceInsert.error.code === '23505') {
      await logAttempt(adminClient, {
        userId,
        eventId,
        source: 'hmac',
        status: 'rejected',
        reason: 'replay',
        codeHash,
      });
      return jsonResponse({ ok: false, error: 'QR già usato.' }, 400);
    }

    console.warn('qr_validation_nonces insert failed', nonceInsert.error.message);
    return jsonResponse({ ok: false, error: 'Verifica QR non disponibile.' }, 500);
  }

  await logAttempt(adminClient, {
    userId,
    eventId,
    source: 'hmac',
    status: 'accepted',
    codeHash,
  });

  return jsonResponse({ ok: true, eventId, source: 'hmac' }, 200);
});
