/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Verify caller JWT and require admin role before allowing bulk deletion
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Autenticazione richiesta' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessione non valida' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userRole = (user.app_metadata as Record<string, unknown>)?.role as string | undefined
    const userRoles = (user.app_metadata as Record<string, unknown>)?.roles as string[] | undefined
    const isAdmin = userRole === 'admin' || (Array.isArray(userRoles) && userRoles.includes('admin'))
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Accesso negato: ruolo admin richiesto' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const supabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const url = new URL(req.url)
    const rawDays = url.searchParams.get('days') ?? ''
    const parsedDays = parseInt(rawDays, 10)
    // Validate: must be an integer >= 7 and <= MAX_DAYS; default to 7 if absent or invalid
    const MIN_DAYS = 7
    const MAX_DAYS = 365
    const MAX_BATCH = 1000
    const clampedDays = isNaN(parsedDays) ? MIN_DAYS : Math.min(Math.max(parsedDays, MIN_DAYS), MAX_DAYS)
    const daysToKeep = (!rawDays || isNaN(parsedDays) || parsedDays < MIN_DAYS) ? MIN_DAYS : clampedDays

    console.log(`🧹 Pulizia eventi più vecchi di ${daysToKeep} giorni...`)

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10)

    // Limit the query to MAX_BATCH rows to prevent full-table scans and
    // unbounded deletion. Callers should re-invoke until deleted === 0 if
    // they need to process more rows than the batch cap.
    const { data: events, error } = await supabaseClient
      .from('events')
      .select('id, name, event_date, event_time')
      .lt('event_date', cutoffDateStr)
      .limit(MAX_BATCH)

    if (error) throw error

    interface Event {
      id: string;
      name: string;
      event_date: string;
    }

    const eventsToDelete: Event[] = (events as Event[]) ?? []

    if (eventsToDelete.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'Nessun evento da cancellare',
          deleted: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log(`🗑️ Trovati ${eventsToDelete.length} eventi da cancellare`)

    const eventIds = eventsToDelete.map(e => e.id)

    // Re-verify that the events still exist immediately before deleting child rows
    // to narrow the TOCTOU window between the initial SELECT and the DELETE pair
    // (closes #1382). A concurrent cleanup run or manual deletion between the two
    // steps could otherwise cause ticket_activations to be deleted for events that
    // a concurrent process already removed — or leave ticket_activations orphaned
    // if the events DELETE later fails.
    //
    // Note: true atomicity requires a PostgreSQL RPC that wraps both DELETEs in a
    // single transaction. This guard reduces — but does not eliminate — the race
    // window without requiring a schema change.
    const { data: stillExistingEvents, error: reVerifyError } = await supabaseClient
      .from('events')
      .select('id')
      .in('id', eventIds)

    if (reVerifyError) throw reVerifyError

    const confirmedEventIds = (stillExistingEvents ?? []).map((e: { id: string }) => e.id)

    if (confirmedEventIds.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'Nessun evento da cancellare (già rimossi da un processo concorrente)',
          deleted: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Delete ticket_activations first: this table references events.id via FK
    // without ON DELETE CASCADE, so it must be removed before the parent rows
    // are deleted to avoid a FK violation that would fail the whole batch.
    // We operate only on the confirmed subset to minimise the blast radius if
    // the events DELETE subsequently fails.
    const { error: activationsError } = await supabaseClient
      .from('ticket_activations')
      .delete()
      .in('event_id', confirmedEventIds)

    if (activationsError) throw activationsError

    // Delete events. The planned_participations FK is defined with
    // ON DELETE CASCADE, so the DB automatically removes those child rows when
    // the parent event is deleted.
    const { error: deleteError } = await supabaseClient
      .from('events')
      .delete()
      .in('id', confirmedEventIds)

    if (deleteError) throw deleteError

    const confirmedDeleted = eventsToDelete.filter(e => confirmedEventIds.includes(e.id))
    return new Response(
      JSON.stringify({
        message: `Cancellati ${confirmedDeleted.length} eventi con successo`,
        deleted: confirmedDeleted.length,
        hasMore: eventsToDelete.length === MAX_BATCH,
        events: confirmedDeleted.map(e => ({ id: e.id, name: e.name, date: e.event_date }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: unknown) {
    console.error('❌ Errore durante la pulizia:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
