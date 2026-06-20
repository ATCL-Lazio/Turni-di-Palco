/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Rate limiting for this endpoint must be enforced at the API gateway level
// (e.g. Supabase dashboard rate-limit rules, a reverse proxy, or a shared
// persistent store such as Upstash Redis). An in-memory Map inside a single
// Deno isolate is NOT effective in production because Supabase Edge Functions
// run multiple concurrent isolates — each with their own memory — so per-isolate
// counters never see the full traffic and the limit is trivially bypassed.
// See issue #1307.

type LeaderboardRow = {
  rank: number;
  name: string;
  role_id: string | null;
  xp_total: number;
  reputation: number;
  profile_image: string | null;
  turns_count: number;
};

function json(body: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Metodo non consentito' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Missing Supabase env vars' }, 500);
  }

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get('limit');
  const parsed = Number(rawLimit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // @ts-ignore – RPC types are not generated here
  const { data, error } = await supabase.rpc('get_public_leaderboard', { p_limit: limit });

  if (error) {
    console.error('[public-leaderboard] RPC error:', error.message);
    return json({ error: 'Errore durante il recupero della classifica.' }, 500);
  }

  const rows = (data ?? []) as LeaderboardRow[];
  return json(
    {
      generated_at: new Date().toISOString(),
      limit,
      count: rows.length,
      entries: rows,
    },
    200,
    { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  );
});
