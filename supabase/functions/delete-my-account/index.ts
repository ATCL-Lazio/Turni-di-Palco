/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Metodo non consentito', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return errorResponse('Configurazione server non disponibile', 500);
  }

  // Verify the caller's JWT to obtain their user ID
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Autenticazione richiesta', 401);
  }

  // User-scoped client (respects RLS) – used to verify identity
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return errorResponse('Sessione non valida', 401);
  }

  const userId = user.id;

  // Admin client – used for privileged deletion
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Delete game data (cascade-safe: ordered by FK dependencies)
  const tablesToDelete = [
    { table: 'activity_completions', key: 'user_id' },
    { table: 'user_badges', key: 'user_id' },
    { table: 'planned_participations', key: 'user_id' },
    { table: 'turns', key: 'user_id' },
    { table: 'profiles', key: 'id' },
  ] as const;

  const failedTables: string[] = [];

  for (const { table, key } of tablesToDelete) {
    const { error } = await adminClient.from(table).delete().eq(key, userId);
    if (error) {
      console.error(`delete-my-account: error deleting from ${table}`, error.message);
      failedTables.push(table);
    }
  }

  // Abort before deleting auth user if critical data remains
  if (failedTables.length > 0) {
    console.error(`delete-my-account: aborting for user ${userId}, orphaned tables: ${failedTables.join(', ')}`);
    return errorResponse(
      `Cancellazione parziale: dati rimasti in ${failedTables.join(', ')}. L'account non è stato eliminato. Riprova o contatta il supporto.`,
      500,
    );
  }

  // 2. Delete profile image from storage (non-fatal)
  const { data: files } = await adminClient.storage
    .from('profile-images')
    .list(userId);
  if (files && files.length > 0) {
    const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
    await adminClient.storage.from('profile-images').remove(paths);
  }

  // 3. Delete the auth user (must be last — only reached if all data was cleaned)
  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.error('delete-my-account: error deleting auth user', deleteUserError.message);
    return errorResponse('Dati eliminati ma impossibile rimuovere l\'account auth. Contatta il supporto.', 500);
  }

  return jsonResponse({ ok: true });
});
