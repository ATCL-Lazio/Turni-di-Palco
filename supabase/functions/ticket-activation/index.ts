/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';
import {
  ATTEMPT_WINDOW_MINUTES,
  canActivateByHash,
  canActivateByTicketNumber,
  canReissueTicket,
  computeVerifier,
  decideAttemptLimit,
  decideDetailsActivation,
  extractClientIp,
  formatRedeemCode,
  generateRedeemCode,
  generateTicketValue,
  matchesStoredVerifier,
  MAX_ATTEMPTS_PER_IP,
  MAX_ATTEMPTS_PER_USER,
} from './guards.ts';

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


function jsonResponse(payload: Record<string, unknown>, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  });
}

function isAdminUser(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  const role = user?.app_metadata?.role as string | undefined;
  const roles = user?.app_metadata?.roles as string[] | undefined;
  return role === 'admin' || (Array.isArray(roles) && roles.includes('admin'));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Server-side key for the redeem-code verifier. Optional TICKET_CODE_PEPPER;
 * otherwise the same fallback as the attempt salt. Changing it invalidates the
 * manual redeem codes of existing tickets (QR activation is unaffected).
 */
function getVerifierKey(fallback: string): string {
  return Deno.env.get('TICKET_CODE_PEPPER') ?? Deno.env.get('TICKET_ATTEMPT_SALT') ?? fallback;
}

/**
 * Records an activation attempt and reports whether the caller is over the
 * per-user / per-IP limit. The IP is stored only as a salted hash.
 *
 * Fails open (and logs) if the attempts table is unavailable, so that the
 * function keeps working if it is deployed before the migration; the limit is
 * only enforced once `ticket_activation_attempts` exists.
 */
async function checkAttemptLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  req: Request,
  salt: string,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  const retryAfterSeconds = ATTEMPT_WINDOW_MINUTES * 60;
  try {
    const ip = extractClientIp(req.headers);
    const ipHash = ip ? await sha256Hex(`${salt}:${ip}`) : null;

    const { error: insertError } = await supabase
      .from('ticket_activation_attempts')
      .insert({ user_id: userId, ip_hash: ipHash, action });
    if (insertError) throw insertError;

    const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: userCount, error: userCountError } = await supabase
      .from('ticket_activation_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    if (userCountError) throw userCountError;

    let ipCount: number | null = null;
    if (ipHash) {
      const { count, error: ipCountError } = await supabase
        .from('ticket_activation_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', since);
      if (ipCountError) throw ipCountError;
      ipCount = count ?? 0;
    }

    // Opportunistic cleanup of old rows (about 1% of calls).
    if (Math.random() < 0.01) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('ticket_activation_attempts').delete().lt('created_at', cutoff);
    }

    const decision = decideAttemptLimit(userCount ?? 0, ipCount, {
      user: MAX_ATTEMPTS_PER_USER,
      ip: MAX_ATTEMPTS_PER_IP,
    });
    return { limited: !decision.allowed, retryAfterSeconds };
  } catch (err) {
    console.warn('[ticket-activation] attempt limiter unavailable, continuing:', (err as { message?: string })?.message);
    return { limited: false, retryAfterSeconds };
  }
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
    const authRequiredActions = [...activationActions, 'issue_ticket', 'reserve_hash', 'resolve_hash'];
    const needsAuthenticatedUser = activationActions.includes(action);
    const needsAuth = authRequiredActions.includes(action);
    let resolvedUserId = typeof requestedUserId === 'string' ? requestedUserId.trim() : '';
    let authenticatedUser: { id: string; app_metadata?: Record<string, unknown> } | null = null;

    if (needsAuth) {
      // Verify JWT signature via Supabase auth (covers issue_ticket, reserve_hash, resolve_hash, and activation actions)
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
      if (!isAdminUser(authenticatedUser)) {
        return jsonResponse({ error: 'Accesso negato: ruolo admin richiesto' }, 403);
      }
      // Client-computed hashes are derived from guessable fields and are no
      // longer accepted. Old clients get a clear message.
      return jsonResponse({ reserved: false, error: 'Aggiorna l\'app per generare i ticket.' }, 200);
    }

    if (action === 'issue_ticket') {
      if (!isAdminUser(authenticatedUser)) {
        return jsonResponse({ error: 'Accesso negato: ruolo admin richiesto' }, 403);
      }
      const adminId = authenticatedUser?.id ?? '';
      if (!adminId || !payload || typeof payload !== 'object') {
        return jsonResponse({ error: 'Missing payload' }, 400);
      }

      const input = payload as Record<string, unknown>;
      // Lowercase circuit on write so it matches the lowercase comparison used by
      // activate_by_ticket_number (closes #1384).
      const circuit = String(input.circuit ?? '').trim().toLowerCase();
      const eventName = String(input.eventName ?? '').trim();
      const eventId = String(input.eventID ?? '').trim();
      const ticketNumber = String(input.ticketNumber ?? '').trim();
      const date = String(input.date ?? '').trim();

      if (!circuit || !eventName || !eventId || !ticketNumber || !date) {
        return jsonResponse({ error: 'Missing payload' }, 400);
      }
      if ([circuit, eventName, eventId, ticketNumber, date].some((v) => v.length > 200)) {
        return jsonResponse({ error: 'Parametri mancanti o non validi.' }, 400);
      }

      // Optional intended recipient (UUID); invalid values are ignored.
      const rawAttendeeId = typeof input.attendeeId === 'string' ? input.attendeeId.trim() : null;
      const attendeeId = rawAttendeeId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAttendeeId)
        ? rawAttendeeId
        : null;

      const genericFailure = { reserved: false, error: 'Impossibile emettere il ticket. Verifica evento e numero biglietto.' };

      const ticketValue = generateTicketValue();
      const redeemCode = generateRedeemCode();
      const verifier = await computeVerifier(getVerifierKey(serviceKey), ticketValue, redeemCode);

      const { error: insertError } = await supabase.from('ticket_activations').insert({
        hash: ticketValue,
        circuit,
        event_name: eventName,
        event_id: eventId,
        ticket_number: ticketNumber,
        date,
        reserved_by: adminId,
        attendee_id: attendeeId,
        redeem_code_verifier: verifier,
      });

      if (!insertError) {
        return jsonResponse({ reserved: true, hash: ticketValue, redeemCode: formatRedeemCode(redeemCode) }, 200);
      }
      if ((insertError as { code?: string }).code !== '23505') throw insertError;

      // The ticket already exists. The reserving admin may re-issue it while it
      // is not activated: the previous QR and code stop working.
      const { data: existing, error: existingError } = await supabase
        .from('ticket_activations')
        .select('hash, reserved_by, activated_by')
        .eq('circuit', circuit)
        .eq('event_id', eventId)
        .eq('ticket_number', ticketNumber)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing || !canReissueTicket({ reservedBy: existing.reserved_by, activatedBy: existing.activated_by }, adminId)) {
        return jsonResponse(genericFailure, 200);
      }

      const { data: replaced, error: replaceError } = await supabase
        .from('ticket_activations')
        .update({
          hash: ticketValue,
          event_name: eventName,
          date,
          attendee_id: attendeeId,
          redeem_code_verifier: verifier,
        })
        .eq('hash', existing.hash)
        .eq('reserved_by', adminId)
        .is('activated_by', null)
        .select('hash');
      if (replaceError) throw replaceError;
      if (!replaced || replaced.length === 0) {
        return jsonResponse(genericFailure, 200);
      }
      return jsonResponse({ reserved: true, hash: ticketValue, redeemCode: formatRedeemCode(redeemCode) }, 200);
    }

    if (action === 'resolve_hash') {
      if (!isAdminUser(authenticatedUser)) {
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

      // Rate limit all activation attempts (QR hash, details, ticket number) per
      // user and per client IP. Tickets are looked up by guessable identifiers, so
      // every activation path is throttled.
      const attemptSalt = Deno.env.get('TICKET_ATTEMPT_SALT') ?? serviceKey;
      const limit = await checkAttemptLimit(supabase, resolvedUserId, action, req, attemptSalt);
      if (limit.limited) {
        return jsonResponse(
          { error: 'Troppi tentativi. Riprova tra qualche minuto.' },
          429,
          { 'Retry-After': String(limit.retryAfterSeconds) },
        );
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

      // Validate hash format for activate_hash (closes #1544).
      // reserve_hash and resolve_hash already enforce /^[0-9a-f]{64}$/ but
      // activate_hash only checked !hash (truthy), allowing malformed input to
      // reach the UPDATE query and potentially trigger unexpected DB behaviour.
      if (action === 'activate_hash') {
        const normalizedHash = typeof hash === 'string' ? hash.trim().toLowerCase() : '';
        if (!/^[0-9a-f]{64}$/.test(normalizedHash)) {
          return jsonResponse({ ok: false, error: 'Hash non valido.' }, 200);
        }
        targetHash = normalizedHash;

        // Attendee-bound tickets can only be claimed by their attendee, even when
        // the QR value is known. Unbound tickets remain claimable by QR holders.
        const { data: hashTicket, error: hashLookupError } = await supabase
          .from('ticket_activations')
          .select('attendee_id')
          .eq('hash', normalizedHash)
          .maybeSingle();
        if (hashLookupError) throw hashLookupError;
        if (hashTicket && !canActivateByHash(hashTicket.attendee_id, resolvedUserId)) {
          return jsonResponse({ error: 'Accesso negato: questo ticket non appartiene all\'utente corrente.' }, 403);
        }
      }

      if (action === 'activate_by_details') {
        const { data: candidates, error: lookupError } = await supabase
          .from('ticket_activations')
          .select('hash, attendee_id, redeem_code_verifier')
          .eq('event_id', payload.eventID)
          .eq('ticket_number', payload.ticketNumber)
          .limit(5);

        if (lookupError) throw lookupError;

        // Rows with a redeem-code verifier need the code (the attendee binding is
        // then irrelevant). Wrong or missing code looks exactly like "not found";
        // the attempt was already counted by the rate limiter above.
        // Legacy rows (no verifier) keep the attendee_id rule.
        let chosenHash: string | null = null;
        let sawForbidden = false;
        for (const row of candidates ?? []) {
          const verifier = typeof row.redeem_code_verifier === 'string' && row.redeem_code_verifier
            ? row.redeem_code_verifier
            : null;
          const codeMatches = verifier && typeof row.hash === 'string'
            ? await matchesStoredVerifier(getVerifierKey(serviceKey), row.hash, payload.redeemCode, verifier)
            : false;
          const decision = decideDetailsActivation({
            attendeeId: row.attendee_id,
            hasVerifier: verifier !== null,
            codeMatches,
            callerId: resolvedUserId,
          });
          if (decision === 'allow') {
            chosenHash = row.hash;
            break;
          }
          if (decision === 'forbidden') sawForbidden = true;
        }

        if (!chosenHash) {
          if (sawForbidden) {
            return jsonResponse({ error: 'Accesso negato: questo ticket non appartiene all\'utente corrente.' }, 403);
          }
          return jsonResponse({ ok: false, error: 'Ticket non trovato.' }, 200);
        }

        targetHash = chosenHash;
      } else if (action === 'activate_by_ticket_number') {
        let query = supabase
          .from('ticket_activations')
          .select('hash, event_id, ticket_number, reserved_by')
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

        // IDOR check: verify the ticket was reserved by the authenticated user (closes #1565).
        // reserve_hash stores the reserving admin's id in `reserved_by`; `user_id` is
        // never written and is therefore always null, causing the old check to fire for
        // every caller (closes #1574).
        // Tickets with reserved_by IS NULL (legacy/migrated tickets or tickets whose
        // generating admin deleted their account) are activatable only by an admin,
        // so they are not permanently locked out (#1605) but cannot be claimed by an
        // arbitrary user who knows the ticket number (#1680).
        if (!canActivateByTicketNumber(tickets[0].reserved_by, resolvedUserId, isAdminUser(authenticatedUser))) {
          return jsonResponse({ error: 'Accesso negato: questo ticket non appartiene all\'utente corrente.' }, 403);
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
