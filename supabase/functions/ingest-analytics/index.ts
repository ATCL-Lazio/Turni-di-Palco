/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

// Persists privacy-first KPI events (issues #321 / #164) into
// public.analytics_events. Authentication is required (the event stream is
// behind login), but the stored rows are pseudonymized: the client sends a
// pre-hashed user_hash (see services/analytics.ts), never a raw uid.

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Closed event set — MUST match AnalyticsEventName in
// apps/mobile/src/services/analytics.ts and the CHECK constraint on
// public.analytics_events.
const ALLOWED_EVENTS = new Set([
  'session_start',
  'onboarding_started',
  'onboarding_completed',
  'first_scenario_completed',
  'activity_completed',
  'turn_registered',
  'share_clicked',
]);

// Allowlist of non-PII property keys (mirrors the client allowlist). Anything
// else is dropped server-side as defense in depth.
const ALLOWED_PROP_KEYS = new Set([
  'surface', 'outcome', 'variant',
  'sceneId', 'activityId', 'rating', 'score', 'durationMs',
  'theatreHash', 'boostRequested', 'boostApplied',
]);

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeProps(value: unknown): Record<string, string | number | boolean | null> {
  if (!isRecord(value)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!ALLOWED_PROP_KEYS.has(k)) continue;
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      // Cap string length defensively.
      out[k] = typeof v === 'string' ? v.slice(0, 200) : v;
    }
  }
  return out;
}

function normalizeUserHash(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // user_hash is an HMAC-SHA256 hex digest; reject anything that is not a
  // plausible hex string so a raw uid/email can never be persisted by mistake.
  if (!/^[a-f0-9]{16,128}$/i.test(trimmed)) return null;
  return trimmed;
}

function normalizeTs(value: unknown): string {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

async function isAuthenticated(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return false;

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await authClient.auth.getUser();
    return !error && !!user;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo non consentito' }, 405);
  }

  if (!(await isAuthenticated(req))) {
    return jsonResponse({ error: 'Autenticazione richiesta' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Payload non valido' }, 400);
  }
  if (!isRecord(body)) {
    return jsonResponse({ error: 'Payload non valido' }, 400);
  }

  const event = typeof body.event === 'string' ? body.event.trim() : '';
  if (!ALLOWED_EVENTS.has(event)) {
    return jsonResponse({ error: `Evento non supportato: ${event || '(vuoto)'}` }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[ingest-analytics] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return jsonResponse({ error: 'Configurazione server incompleta' }, 500);
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await admin.from('analytics_events').insert({
      event,
      user_hash: normalizeUserHash(body.userHash),
      props: sanitizeProps(body.props),
      ts: normalizeTs(body.ts),
    });

    if (error) {
      console.error('[ingest-analytics] insert failed', error.message);
      return jsonResponse({ error: 'Persistenza fallita' }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('[ingest-analytics] unexpected error', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
