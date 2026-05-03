/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

type ChangelogEntry = {
  sha: string;
  message: string;
  date: string | null;
  author: string;
  url: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Metodo non consentito', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (supabaseUrl && anonKey) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Autenticazione richiesta', 401);
    }
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.48.0');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse('Autenticazione richiesta', 401);
    }
  }

  const appVersion = Deno.env.get('APP_VERSION') ?? '0.0.5';
  const repo = Deno.env.get('APP_REPO') ?? 'ATCL-Lazio/Turni-di-Palco';
  const githubToken = Deno.env.get('GITHUB_TOKEN');

  let payload: { limit?: number } = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const requestedLimit = Number(payload.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const headers: Record<string, string> = {
    'User-Agent': 'turni-di-palco-app',
    Accept: 'application/vnd.github+json',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const url = `https://api.github.com/repos/${repo}/commits?per_page=${limit}`;
  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    console.error('[app-version] GitHub fetch failed', err);
    return errorResponse('Impossibile caricare il changelog', 502);
  }
  if (!response.ok) {
    console.error('[app-version] GitHub API error', response.status, response.statusText);
    return errorResponse('Impossibile caricare il changelog', 502);
  }

  let json: any[] = [];
  try {
    const parsed = await response.json();
    json = Array.isArray(parsed) ? parsed : [];
  } catch {
    json = [];
  }

  const changelog: ChangelogEntry[] = json.map((item) => {
    const message = String(item?.commit?.message ?? '').split('\n')[0].trim();
    return {
      sha: String(item?.sha ?? '').slice(0, 7),
      message: message || 'Aggiornamento',
      date: item?.commit?.committer?.date ?? item?.commit?.author?.date ?? null,
      author: item?.commit?.author?.name ?? item?.commit?.committer?.name ?? 'Unknown',
      url: item?.html_url ?? '',
    };
  });

  return jsonResponse({ version: appVersion, repo, changelog });
});
