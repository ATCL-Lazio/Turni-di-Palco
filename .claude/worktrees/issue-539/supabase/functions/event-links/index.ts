/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EVENT_ID_PATTERN = /\b([A-Za-z]{2,10}-\d{1,6})\b/;

type EventRow = {
  id: string;
  name: string;
  theatre: string;
  event_date: string;
  event_time: string;
  genre: string;
  base_rewards: Record<string, number>;
  focus_role: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeEventId(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase();
}

function extractEventId(payload: string | null | undefined) {
  const raw = (payload ?? '').trim();
  if (!raw) return '';

  try {
    const asUrl = new URL(raw);
    const fromQuery = asUrl.searchParams.get('event_id') ?? asUrl.searchParams.get('eid');
    if (fromQuery) return normalizeEventId(fromQuery);
    const fromPath = asUrl.pathname.match(EVENT_ID_PATTERN)?.[1];
    if (fromPath) return normalizeEventId(fromPath);
  } catch {
    // ignore and fallback to plain-text parsing
  }

  const textMatch = raw.match(EVENT_ID_PATTERN)?.[1];
  return normalizeEventId(textMatch ?? raw);
}

const ALLOWED_HOSTS = [
  'turnidipalco.it',
  'www.turnidipalco.it',
  'turni-di-palco.onrender.com',
  'turni-di-palco-fq85.onrender.com',
  'maxwell-ai-support.onrender.com',
];

const DEFAULT_BASE_URL = 'https://turnidipalco.it/mobile/index.html';

function isAllowedBaseUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.some((h) => url.hostname === h);
  } catch {
    return false;
  }
}

function sanitizeBaseUrl(raw: string): string {
  return isAllowedBaseUrl(raw) ? raw : DEFAULT_BASE_URL;
}

function buildDeepLink(baseUrl: string, eventId: string, roleId: string | null) {
  const url = new URL(baseUrl);
  url.searchParams.set('from', 'qr');
  url.searchParams.set('event_id', eventId);
  if (roleId) {
    url.searchParams.set('role_id', roleId);
  }
  return url.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo non consentito' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Missing Supabase env vars' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Payload JSON non valido' }, 400);
  }

  const action = String(body.action ?? 'validate_qr');

  if (action === 'validate_qr') {
    const qrPayload = String(body.qrPayload ?? body.code ?? '');
    const extractedId = extractEventId(qrPayload);
    if (!extractedId) {
      return json({ valid: false, error: 'QR non valido: ID evento mancante.' }, 400);
    }

    // @ts-ignore
    const { data, error } = await supabase
      .from('events')
      .select('id,name,theatre,event_date,event_time,genre,base_rewards,focus_role')
      .eq('id', extractedId)
      .maybeSingle<EventRow>();

    if (error) {
      return json({ valid: false, error: error.message }, 500);
    }

    if (!data) {
      return json({ valid: false, error: 'Evento non trovato.', eventId: extractedId }, 404);
    }

    const baseUrl = sanitizeBaseUrl(String(body.baseUrl ?? DEFAULT_BASE_URL));
    return json({
      valid: true,
      eventId: data.id,
      event: data,
      deepLink: buildDeepLink(baseUrl, data.id, null),
    });
  }

  if (action === 'create_deep_link') {
    const eventId = normalizeEventId(String(body.eventId ?? ''));
    const roleId = String(body.roleId ?? '').trim() || null;
    const baseUrl = sanitizeBaseUrl(String(body.baseUrl ?? DEFAULT_BASE_URL));

    if (!eventId) {
      return json({ error: 'eventId obbligatorio' }, 400);
    }

    // @ts-ignore
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle<{ id: string }>();

    if (error) {
      return json({ error: error.message }, 500);
    }

    if (!data) {
      return json({ error: 'Evento non trovato', eventId }, 404);
    }

    return json({ eventId, deepLink: buildDeepLink(baseUrl, eventId, roleId) });
  }

  if (action === 'resolve_deep_link') {
    const targetUrl = String(body.url ?? '');
    if (!targetUrl) {
      return json({ error: 'url obbligatorio' }, 400);
    }

    let url: URL;
    try {
      url = new URL(targetUrl);
    } catch {
      return json({ error: 'url non valida' }, 400);
    }

    const eventId = normalizeEventId(url.searchParams.get('event_id') ?? url.searchParams.get('eid'));
    const roleId = url.searchParams.get('role_id');
    if (!eventId) {
      return json({ error: 'event_id mancante' }, 400);
    }

    // @ts-ignore
    const { data, error } = await supabase
      .from('events')
      .select('id,name,theatre,event_date,event_time,genre,base_rewards,focus_role')
      .eq('id', eventId)
      .maybeSingle<EventRow>();

    if (error) {
      return json({ resolved: false, error: error.message }, 500);
    }

    if (!data) {
      return json({ resolved: false, error: 'Evento non trovato', eventId }, 404);
    }

    return json({ resolved: true, eventId, roleId, event: data });
  }

  return json({ error: `Azione non supportata: ${action}` }, 400);
});
