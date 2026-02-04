import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DevAccessResponse = {
  allowed: boolean;
  reason?: string;
};

type DevAccessAudit = {
  user_id: string;
  user_email: string | null;
  user_roles: string[];
  path: string | null;
  reason: string;
};

function parseEnvList(value: string | null) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getUserRoles(user: Record<string, unknown>) {
  const roles = new Set<string>();
  const appMetadata = user.app_metadata as Record<string, unknown> | null | undefined;
  const userMetadata = user.user_metadata as Record<string, unknown> | null | undefined;
  const metadataList = [appMetadata, userMetadata].filter(Boolean) as Record<string, unknown>[];

  metadataList.forEach((metadata) => {
    const roleValue = metadata.role;
    const rolesValue = metadata.roles;

    if (typeof roleValue === 'string') roles.add(roleValue);
    if (Array.isArray(roleValue)) {
      roleValue.filter((item) => typeof item === 'string').forEach((item) => roles.add(item));
    }

    if (typeof rolesValue === 'string') {
      rolesValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => roles.add(item));
    }
    if (Array.isArray(rolesValue)) {
      rolesValue.filter((item) => typeof item === 'string').forEach((item) => roles.add(item));
    }
  });

  return Array.from(roles);
}

function isUserAllowed(
  user: { email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  allowedEmails: string[],
  allowedRoles: string[]
) {
  if (user.email && allowedEmails.includes(user.email)) return true;
  if (!allowedRoles.length) return false;
  const userRoles = getUserRoles(user as Record<string, unknown>);
  return userRoles.some((role) => allowedRoles.includes(role));
}

function jsonResponse(body: DevAccessResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ allowed: false, reason: 'Metodo non consentito.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const allowedRoles = parseEnvList(Deno.env.get('DEV_ALLOWED_ROLES') ?? 'dev');
  const allowedEmails = parseEnvList(Deno.env.get('DEV_ALLOWED_EMAILS') ?? '');

  let payload: { path?: string } = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data, error } = await supabaseClient.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    return jsonResponse({ allowed: false, reason: 'Utente non autenticato.' }, 401);
  }

  const allowed = isUserAllowed(user, allowedEmails, allowedRoles);
  if (allowed) {
    return jsonResponse({ allowed: true });
  }

  if (serviceRoleKey) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userRoles = getUserRoles(user as Record<string, unknown>);
    const auditEntry: DevAccessAudit = {
      user_id: user.id,
      user_email: user.email ?? null,
      user_roles: userRoles,
      path: payload.path ?? null,
      reason: 'not_allowed',
    };

    const { error: insertError } = await adminClient.from('dev_access_audit').insert(auditEntry);
    if (insertError) {
      console.error('Dev access audit insert failed', insertError.message);
    }
  } else {
    console.warn('Missing SUPABASE_SERVICE_ROLE_KEY for dev access audit logging.');
  }

  return jsonResponse({ allowed: false, reason: 'Accesso non autorizzato.' }, 403);
});
