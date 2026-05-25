/// <reference path="../@types/deno.d.ts" />
// Edge Function: pseudonymize-user-id
//
// GDPR-grade pseudonymization for analytics user IDs (issue #1086).
//
// The ANALYTICS_SALT secret never leaves the server — it is read from Deno
// environment variables set via `supabase secrets set ANALYTICS_SALT=<value>`.
// The client only receives the resulting HMAC-SHA256 hex digest, which cannot
// be reversed without the salt.
//
// Usage:
//   POST /functions/v1/pseudonymize-user-id
//   Authorization: Bearer <user JWT>
//   Content-Type: application/json
//   Body: { "userId": "<supabase-uuid>" }
//
//   Response 200: { "hash": "<64-char hex string>" }
//   Response 400: { "error": "..." }    — bad request
//   Response 401: { "error": "..." }    — missing/invalid JWT
//   Response 500: { "error": "..." }    — missing server config

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Computes HMAC-SHA256(secret, message) and returns the result as a lowercase
 * hex string. This runs entirely inside the Deno runtime — the `secret` (i.e.
 * ANALYTICS_SALT) is never sent to any third-party service.
 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // --- Server-side config ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const analyticsSalt = Deno.env.get('ANALYTICS_SALT');

  if (!supabaseUrl || !anonKey) {
    console.error('[pseudonymize-user-id] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  if (!analyticsSalt || analyticsSalt.length === 0) {
    console.error('[pseudonymize-user-id] ANALYTICS_SALT secret is not configured');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  // --- Authenticate the request ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }

  // --- Parse request body ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const userId = body['userId'];
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return jsonResponse({ error: 'Missing or invalid userId' }, 400);
  }

  // Basic UUID format validation (Supabase UUIDs are v4).
  // We accept any non-empty string to stay forward-compatible, but at least
  // reject obviously malformed inputs that could inflate the server logs.
  const trimmedUserId = userId.trim();
  if (trimmedUserId.length > 256) {
    return jsonResponse({ error: 'userId too long' }, 400);
  }

  // --- IDOR guard: only allow hashing your own userId ---
  // Without this check any authenticated user can query the hash for
  // arbitrary UUIDs, turning this endpoint into a hash oracle and
  // undermining the GDPR pseudonymization model.
  if (trimmedUserId !== user.id) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  // --- Compute HMAC-SHA256 hash ---
  try {
    const hash = await hmacSha256Hex(analyticsSalt, trimmedUserId);
    return jsonResponse({ hash });
  } catch (err) {
    console.error('[pseudonymize-user-id] HMAC computation failed:', err);
    return jsonResponse({ error: 'Hash computation failed' }, 500);
  }
});
