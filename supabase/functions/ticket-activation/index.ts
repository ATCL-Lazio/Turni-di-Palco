/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Missing environment variables' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, hash, payload, userId: requestedUserId } = await req.json();

    const activationActions = ['activate_hash', 'activate_by_details', 'activate_by_ticket_number'];
    const needsAuthenticatedUser = activationActions.includes(action);
    let resolvedUserId = typeof requestedUserId === 'string' ? requestedUserId.trim() : '';

    if (needsAuthenticatedUser) {
      const authHeader = req.headers.get('Authorization');
      console.log('[auth] Header present:', Boolean(authHeader), 'starts-with-Bearer:', authHeader?.startsWith('Bearer ') ?? false);

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('[auth] Missing or invalid Authorization header');
        return jsonResponse({ error: 'Sessione scaduta o non disponibile. Effettua di nuovo il login.' }, 401);
      }

      const token = authHeader.slice('Bearer '.length);
      console.log('[auth] Token length:', token.length, 'prefix:', token.slice(0, 20));

      // The gateway already verified the JWT signature and expiry via verify_jwt: true.
      // Decode the payload to extract the sub claim (user ID) without a redundant getUser call.
      let userId: string | undefined;
      try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Malformed JWT');
        // JWT uses base64url encoding; convert to standard base64 for atob
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
        const payload = JSON.parse(atob(padded));
        userId = typeof payload.sub === 'string' ? payload.sub : undefined;
        console.log('[auth] JWT sub:', userId ?? '(missing)');
      } catch (decodeErr) {
        console.error('[auth] JWT decode failed:', (decodeErr as Error).message);
        return jsonResponse({ error: 'Sessione scaduta o non disponibile. Effettua di nuovo il login.' }, 401);
      }

      if (!userId) {
        console.error('[auth] JWT has no sub claim (anon key or service key passed as user token)');
        return jsonResponse({ error: 'Sessione scaduta o non disponibile. Effettua di nuovo il login.' }, 401);
      }

      // Do not trust userId sent by client payload if we have an authenticated user.
      resolvedUserId = userId;
    }

    if (action === 'reserve_hash') {
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

      // Insert new ticket activation record (unassigned)
      const { error: insertError } = await supabase.from('ticket_activations').insert({
        hash: normalizedHash,
        circuit,
        event_name: eventName,
        event_id: eventId,
        ticket_number: ticketNumber,
        date,
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
        return jsonResponse({
          error: 'Missing required parameters',
          received: {
            action,
            hasHash: !!hash,
            hasPayload: !!payload,
            hasTicketNumber: !!payload?.ticketNumber,
            hasUserId: !!resolvedUserId,
          },
        }, 400);
      }

      // 1. Resolve hash if using details or ticket number
      let targetHash = hash;

      if (action === 'activate_by_details') {
        const { data: ticket } = await supabase
          .from('ticket_activations')
          .select('hash')
          .eq('event_id', payload.eventID)
          .eq('ticket_number', payload.ticketNumber)
          .maybeSingle();

        if (!ticket) {
          return jsonResponse({ ok: false, error: 'Ticket non trovato.' }, 200);
        }
        targetHash = ticket.hash;
      } else if (action === 'activate_by_ticket_number') {
        let query = supabase
          .from('ticket_activations')
          .select('hash, event_id, ticket_number')
          .eq('ticket_number', payload.ticketNumber);

        if (payload.circuit) {
          query = query.ilike('circuit', payload.circuit.trim());
        }
        if (payload.eventID) {
          query = query.eq('event_id', payload.eventID.trim());
        }

        const { data: tickets, error: searchError } = await query;

        if (searchError) throw searchError;

        if (!tickets || tickets.length === 0) {
          return jsonResponse({ ok: false, error: 'Ticket non trovato.' }, 200);
        }

        if (tickets.length > 1) {
          return jsonResponse({ ok: false, error: 'Ticket number non univoco. Specifica Circuito o Evento.' }, 200);
        }

        targetHash = tickets[0].hash;
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
      const { data: current } = await supabase
        .from('ticket_activations')
        .select('activated_by')
        .eq('hash', targetHash)
        .single();

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
    console.error(err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
