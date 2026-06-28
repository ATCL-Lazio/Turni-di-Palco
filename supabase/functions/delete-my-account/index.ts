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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return errorResponse('Configurazione server non disponibile', 500);
  }

  // Verify the caller's JWT to obtain their user ID
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Autenticazione richiesta', 401);
  }

  // User-scoped client (respects RLS) – used to verify identity
  const userClient = createClient(supabaseUrl, anonKey, {
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
  //
  // ticket_activations is deleted twice — once by activated_by (tickets the
  // user activated) and once by reserved_by (tickets the user generated as an
  // admin but that were never activated). Without the reserved_by delete,
  // unactivated tickets from a deleted admin remain in the DB and can still be
  // scanned and activated by anyone, violating GDPR Art. 17 (closes #1385).
  const tablesToDelete = [
    { table: 'ticket_activations', key: 'activated_by' },
    { table: 'ticket_activations', key: 'reserved_by' },
    { table: 'activity_completions', key: 'user_id' },
    { table: 'user_badges', key: 'user_id' },
    { table: 'planned_participations', key: 'user_id' },
    { table: 'narrative_history', key: 'user_id' },
    { table: 'shop_purchases', key: 'user_id' },
    { table: 'turns', key: 'user_id' },
    { table: 'profiles', key: 'id' },
  ] as const;

  let failedTable: string | null = null;

  for (const { table, key } of tablesToDelete) {
    const { error } = await adminClient.from(table).delete().eq(key, userId);
    if (error) {
      console.error(`delete-my-account: error deleting from ${table} (key: ${key})`, error.message);
      failedTable = `${table}.${key}`;
      break;
    }
  }

  // Abort before deleting auth user if any table deletion failed.
  // Stopping at the first failure preserves subsequent tables so the user
  // can retry without ending up in a worse partial-deletion state.
  if (failedTable !== null) {
    console.error(`delete-my-account: aborting for user ${userId}, failed on table: ${failedTable}`);
    return errorResponse(
      `Cancellazione non completata: errore su ${failedTable}. L'account non è stato eliminato. Riprova o contatta il supporto.`,
      500,
    );
  }

  // 2. Delete profile image from storage (non-fatal, with timeout guard)
  // Each operation gets its own independent timeout promise so that a slow
  // list() call does not shrink the effective timeout for remove() (closes #1351).
  const makeStorageTimeout = () =>
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('storage timeout')), 10_000),
    );
  try {
    const { data: files } = await Promise.race([
      adminClient.storage.from('profile-images').list(userId),
      makeStorageTimeout(),
    ]);
    if (files && files.length > 0) {
      const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
      await Promise.race([
        adminClient.storage.from('profile-images').remove(paths),
        makeStorageTimeout(),
      ]);
    }
  } catch (storageError) {
    console.error('delete-my-account: storage cleanup timed out or failed (non-fatal)', storageError);
  }

  // 3. Delete the auth user (must be last — only reached if all data was cleaned)
  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.error('delete-my-account: error deleting auth user', deleteUserError.message);
    return errorResponse('Dati eliminati ma impossibile rimuovere l\'account auth. Contatta il supporto.', 500);
  }

  return jsonResponse({ ok: true });
});
