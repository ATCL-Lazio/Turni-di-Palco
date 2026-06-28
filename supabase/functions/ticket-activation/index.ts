/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function loadEventSnapshot(supabase: ReturnType<typeof createClient>, eventId: string | null | undefined) {
  if (!eventId) return null;

  const { data, error } = await supabase
    .from('events')
    .select('id,name,theatre,event_date,event_time,genre,base_rewards,focus_role')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    console.warn('Unable to load event snapshot', eventId, error.message);
    return null;
  }

  return data ?? null;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo non consentito' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: 'Missing environment variables' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  try {
    const { action, hash, payload, userId: requestedUserId } = body;

    const activationActions = ['activate_hash', 'activate_by_details', 'activate_by_ticket_number'];
    const authRequiredActions = [...activationActions, 'reserve_hash', 'resolve_hash'];
    const needsAuthenticatedUser = activationActions.includes(action);
    const needsAuth = authRequiredActions.includes(action);
    let resolvedUserId = typeof requestedUserId === 'string' ? requestedUserId.trim() : '';
    let authenticatedUser: { id: string; app_metadata?: Record<string, unknown> } | null = null;

    if (needsAuth) {
      // Verify JWT signature via Supabase auth (covers reserve_hash, resolve_hash, and activation actions)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Sessione scaduta o non disponibile. Effettua di nuovo il login.' }, 401);
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return jsonResponse({ error: 'Sessione scaduta o non disponibile. Effettua di nuovo il login.' }, 401);
      }

      authenticatedUser = user as { id: string; app_metadata?: Record<string, unknown> };

      if (needsAuthenticatedUser) {
        // Do not trust userId sent by client payload: use the verified identity.
        resolvedUserId = user.id;
      }
    }

    if (action === 'reserve_hash') {
      const roleSingle = authenticatedUser?.app_metadata?.role as string | undefined;
      const rolesArray = authenticatedUser?.app_metadata?.roles as string[] | undefined;
      const isAdmin =
        roleSingle === 'admin' ||
        (Array.isArray(rolesArray) && rolesArray.includes('admin'));
      if (!isAdmin) {
        return jsonResponse({ error: 'Accesso negato: ruolo admin richiesto' }, 403);
      }

      if (!hash || !payload) {
        return jsonResponse({ error: 'Missing hash or payload' }, 400);
      }

      const normalizedHash = typeof hash === 'string' ? hash.trim().toLowerCase() : '';
      if (!/^[0-9a-f]{64}$/.test(normalizedHash)) {
        return jsonResponse({ reserved: false, error: 'Hash non valido.' }, 200);
      }

      const normalizedPayload = payload as {
        circuit?: unknown;
        eventName?: unknown;
        eventID?: unknown;
        ticketNumber?: unknown;
        date?: unknown;
      };

      const circuit = String(normalizedPayload.circuit ?? '').trim();
      const eventName = String(normalizedPayload.eventName ?? '').trim();
      const eventId = String(normalizedPayload.eventID ?? '').trim();
      const ticketNumber = String(normalizedPayload.ticketNumber ?? '').trim();
      const date = String(normalizedPayload.date ?? '').trim();

      if (!circuit || !eventName || !eventId || !ticketNumber || !date) {
        return jsonResponse({ error: 'Missing hash or payload' }, 400);
      }

      // Insert new ticket activation record (unassigned).
      // reserved_by records the generating admin's user ID so that
      // delete-my-account can clean up unactivated tickets when the admin
      // deletes their account (GDPR Art. 17, closes #1385).
      const { error: insertError } = await supabase.from('ticket_activations').insert({
        hash: normalizedHash,
        circuit,
        event_name: eventName,
        event_id: eventId,
        ticket_number: ticketNumber,
        date,
        reserved_by: authenticatedUser?.id ?? null,
      });

      if (insertError) {
        // Primary key collision -> hash already reserved by another process.
        if ((insertError as { code?: string }).code === '23505') {
          return jsonResponse({ reserved: false, error: 'Hash already exists' }, 200);
        }
        throw insertError;
      }

      return jsonResponse({ reserved: true }, 200);
    }

    if (action === 'resolve_hash') {
      const resolveRoleSingle = authenticatedUser?.app_metadata?.role as string | undefined;
      const resolveRolesArray = authenticatedUser?.app_metadata?.roles as string[] | undefined;
      const isResolveAdmin =
        resolveRoleSingle === 'admin' ||
        (Array.isArray(resolveRolesArray) && resolveRolesArray.includes('admin'));
      if (!isResolveAdmin) {
        return jsonResponse({ error: 'Accesso negato: ruolo admin richiesto' }, 403);
      }

      if (!hash || typeof hash !== 'string') {
        return jsonResponse({ error: 'Missing hash' }, 400);
      }

      const normalizedHash = hash.trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(normalizedHash)) {
        return jsonResponse({ ok: false, error: 'Hash non valido.' }, 200);
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('ticket_activations')
        .select('event_id,event_name,activated_by')
        .eq('hash', normalizedHash)
        .maybeSingle();

      if (ticketError) {
        throw ticketError;
      }

      if (!ticket) {
        return jsonResponse({ ok: false, error: 'Ticket non trovato.' }, 200);
      }

      if (ticket.activated_by) {
        return jsonResponse({
          ok: false,
          alreadyActivated: true,
          error: 'Ticket già attivato.',
        }, 200);
      }

      const eventSnapshot = await loadEventSnapshot(supabase, ticket.event_id);
      return jsonResponse({
        ok: true,
        eventId: ticket.event_id,
        eventName: ticket.event_name,
        event: eventSnapshot,
      }, 200);
    }

    if (action === 'activate_hash' || action === 'activate_by_details' || action === 'activate_by_ticket_number') {
      if (
        !resolvedUserId ||
        (action === 'activate_hash' && !hash) ||
        (action === 'activate_by_details' && (!payload?.eventID || !payload?.ticketNumber)) ||
        (action === 'activate_by_ticket_number' && !payload?.ticketNumber)
      ) {
        return jsonResponse({ error: 'Parametri mancanti o non validi.' }, 400);
      }

      // 1. Resolve hash if using details or ticket number
      //
      // TOCTOU note: activate_by_details and activate_by_ticket_number perform a
      // two-step read-then-write: a SELECT resolves the hash, followed by an atomic
      // UPDATE … WHERE activated_by IS NULL. Between those two steps, a concurrent
      // request for the same ticket could also read the hash and attempt to activate it.
      //
      // The risk is mitigated at the DB level: the UPDATE is conditional on
      // `activated_by IS NULL`, so only one concurrent caller can win. The losing
      // caller receives an empty result set and falls through to the re-check below,
      // which correctly returns alreadyActivated: true. No double-activation of data
      // is possible; the worst-case outcome is that two callers briefly believe they
      // initiated the activation until the re-check resolves the conflict.
      //
      // A fully atomic solution would use a single PostgreSQL RPC that combines
      // SELECT + UPDATE … RETURNING in one statement (see issue #1304).
      let targetHash = hash;

      if (action === 'activate_by_details') {
        const { data: ticket, error: lookupError } = await supabase
          .from('ticket_activations')
          .select('hash')
          .eq('event_id', payload.eventID)
          .eq('ticket_number', payload.ticketNumber)
          .maybeSingle();

        if (lookupError) throw lookupError;

        if (!ticket) {
          return jsonResponse({ ok: false, error: 'Ticket non trovato.' }, 200);
        }
        targetHash = ticket.hash;

        if (targetHash == null) {
          return jsonResponse({ ok: false, error: 'Ticket non attivabile: hash mancante.' }, 200);
        }
      } else if (action === 'activate_by_ticket_number') {
        let query = supabase
          .from('ticket_activations')
          .select('hash, event_id, ticket_number')
          .eq('ticket_number', payload.ticketNumber);

        if (payload.circuit !== undefined && payload.circuit !== null && payload.circuit !== '') {
          if (typeof payload.circuit !== 'string') {
            return jsonResponse({ error: 'Parametro circuit non valido.' }, 400);
          }
          // Use case-insensitive exact match (.eq on lowercased value) instead of
          // .ilike() to prevent SQL LIKE wildcard injection via the circuit field
          // (closes #1357). ilike() treats % and _ as pattern metacharacters.
          query = query.eq('circuit', payload.circuit.trim().toLowerCase());
        }
        if (payload.eventID !== undefined && payload.eventID !== null && payload.eventID !== '') {
          if (typeof payload.eventID !== 'string') {
            return jsonResponse({ error: 'Parametro eventID non valido.' }, 400);
          }
          query = query.eq('event_id', payload.eventID.trim());
        }

        const { data: tickets, error: searchError } = await query.limit(2);

        if (searchError) throw searchError;

        if (!tickets || tickets.length === 0) {
          return jsonResponse({ ok: false, error: 'Ticket non trovato.' }, 200);
        }

        if (tickets.length > 1) {
          return jsonResponse({ ok: false, error: 'Ticket number non univoco. Specifica Circuito o Evento.' }, 200);
        }

        targetHash = tickets[0].hash;

        if (targetHash == null) {
          return jsonResponse({ ok: false, error: 'Ticket non attivabile: hash mancante.' }, 200);
        }
      }

      // 2. Atomic activation update
      const { data, error } = await supabase
        .from('ticket_activations')
        .update({
          activated_by: resolvedUserId,
          activated_at: new Date().toISOString(),
        })
        .eq('hash', targetHash)
        .is('activated_by', null)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const record = data[0];
        const eventSnapshot = await loadEventSnapshot(supabase, record.event_id);
        return jsonResponse({
          ok: true,
          eventId: record.event_id,
          eventName: record.event_name,
          event: eventSnapshot,
        }, 200);
      }

      // 3. Check current status if update failed
      const { data: current, error: fallbackError } = await supabase
        .from('ticket_activations')
        .select('activated_by')
        .eq('hash', targetHash)
        .maybeSingle();

      if (fallbackError) {
        console.error('[ticket-activation] fallback select error:', fallbackError);
        return jsonResponse({ error: 'Activation failed' }, 500);
      }

      if (!current) {
        return jsonResponse({ ok: false, error: 'Ticket non trovato.' }, 200);
      }

      return jsonResponse({
        ok: false,
        alreadyActivated: true,
      }, 200);
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (err) {
    console.error('[ticket-activation] unexpected error:', err);
    return jsonResponse({ error: 'Activation failed' }, 500);
  }
});
