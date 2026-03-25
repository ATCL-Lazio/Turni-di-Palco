/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const DEFAULT_CIRCUIT = 'TicketOne';

// Rome timezone offset (+01:00 CET). Matches Python generator's dt.timezone(dt.timedelta(hours=1)).
const ROME_OFFSET = '+01:00';

function buildCanonicalJson(fields: {
  circuit: string;
  eventName: string;
  eventID: string;
  ticketNumber: string;
  date: string;
}): string {
  // Must match Python's json.dumps(OrderedDict(...), ensure_ascii=False, separators=(",",":"))
  // and JS client's JSON.stringify with explicit key order.
  return JSON.stringify({
    circuit: fields.circuit,
    eventName: fields.eventName,
    eventID: fields.eventID,
    ticketNumber: fields.ticketNumber,
    date: fields.date,
  });
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildEventDatetimeIso(eventDate: string, eventTime: string): string {
  // eventDate: "2026-03-15" or "15 Marzo 2026" etc. — from DB it's ISO date.
  // eventTime: "21:00" or "21:00:00"
  const date = eventDate.trim();
  const time = eventTime.trim();
  const timeParts = time.split(':');
  const normalizedTime =
    timeParts.length === 2 ? `${time}:00` : time;
  return `${date}T${normalizedTime}${ROME_OFFSET}`;
}

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

    const activationActions = ['activate_hash', 'activate_by_details', 'activate_by_ticket_number', 'register_ticket'];
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

    if (action === 'register_ticket') {
      const ticketNumber = typeof payload?.ticketNumber === 'string' ? payload.ticketNumber.trim() : '';
      const eventID = typeof payload?.eventID === 'string' ? payload.eventID.trim() : '';
      const circuit = typeof payload?.circuit === 'string' && payload.circuit.trim()
        ? payload.circuit.trim()
        : DEFAULT_CIRCUIT;

      if (!ticketNumber || !eventID || !resolvedUserId) {
        return jsonResponse({ error: 'Dati mancanti: eventID, ticketNumber e sessione sono obbligatori.' }, 400);
      }

      // 1. Load event from calendar to get name + date + time
      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select('id,name,event_date,event_time,theatre,genre,base_rewards,focus_role')
        .eq('id', eventID)
        .maybeSingle();

      if (eventError) throw eventError;
      if (!eventRow) {
        return jsonResponse({ ok: false, error: 'Evento non trovato nel calendario.' }, 200);
      }

      const eventName = String(eventRow.name ?? '').trim();
      const eventDate = String(eventRow.event_date ?? '').trim();
      const eventTime = String(eventRow.event_time ?? '').trim();

      if (!eventName || !eventDate || !eventTime) {
        return jsonResponse({ ok: false, error: 'Dati evento incompleti nel calendario.' }, 200);
      }

      // 2. Build canonical JSON and compute SHA-256 (matching Python generator algorithm)
      const dateIso = buildEventDatetimeIso(eventDate, eventTime);
      const canonicalJson = buildCanonicalJson({
        circuit,
        eventName,
        eventID: eventRow.id,
        ticketNumber,
        date: dateIso,
      });
      const computedHash = await sha256Hex(canonicalJson);

      // 3. Verify client-provided hash if present
      const clientHash = typeof payload?.clientHash === 'string' ? payload.clientHash.trim().toLowerCase() : '';
      if (clientHash && clientHash !== computedHash) {
        return jsonResponse({ ok: false, error: 'Hash biglietto non corrisponde. Verifica i dati inseriti.' }, 200);
      }

      // 4. Try to insert + activate atomically (new ticket not pre-registered)
      const now = new Date().toISOString();
      const { error: insertError } = await supabase.from('ticket_activations').insert({
        hash: computedHash,
        circuit,
        event_name: eventName,
        event_id: eventRow.id,
        ticket_number: ticketNumber,
        date: dateIso,
        activated_by: resolvedUserId,
        activated_at: now,
      });

      if (!insertError) {
        // Successfully created and activated in one step
        return jsonResponse({
          ok: true,
          eventId: eventRow.id,
          eventName,
          hash: computedHash,
          event: eventRow,
        }, 200);
      }

      // 5. PK collision: ticket already exists (pre-registered or duplicate)
      if ((insertError as { code?: string }).code === '23505') {
        // Try to activate the existing unactivated record
        const { data: activated, error: activateError } = await supabase
          .from('ticket_activations')
          .update({ activated_by: resolvedUserId, activated_at: now })
          .eq('hash', computedHash)
          .is('activated_by', null)
          .select();

        if (activateError) throw activateError;

        if (activated && activated.length > 0) {
          return jsonResponse({
            ok: true,
            eventId: eventRow.id,
            eventName,
            hash: computedHash,
            event: eventRow,
          }, 200);
        }

        // Already activated by someone else
        return jsonResponse({
          ok: false,
          alreadyActivated: true,
          error: 'Questo biglietto è già stato utilizzato.',
        }, 200);
      }

      throw insertError;
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
