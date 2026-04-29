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
    if (userRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Accesso negato: ruolo admin richiesto' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const supabaseClient = createClient(supabaseUrl, serviceKey)

    const url = new URL(req.url)
    const rawDays = url.searchParams.get('days') ?? ''
    const parsedDays = parseInt(rawDays, 10)
    // Validate: must be an integer >= 7; default to 7 if absent or invalid
    const MIN_DAYS = 7
    const daysToKeep = (!rawDays || isNaN(parsedDays) || parsedDays < MIN_DAYS) ? MIN_DAYS : parsedDays

    console.log(`🧹 Pulizia eventi più vecchi di ${daysToKeep} giorni...`)

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffDateStr = cutoffDate.toISOString().slice(0, 10)

    const { data: events, error } = await supabaseClient
      .from('events')
      .select('id, name, event_date, event_time')
      .lt('event_date', cutoffDateStr)

    if (error) throw error

    interface Event {
      id: string;
      name: string;
      event_date: string;
    }

    const eventsToDelete = (events as Event[] || []).filter((event: Event) => {
      if (!event?.event_date) return false
      return event.event_date < cutoffDateStr
    })

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

    const { error: deleteError } = await supabaseClient
      .from('events')
      .delete()
      .in('id', eventsToDelete.map(e => e.id))

    if (deleteError) throw deleteError

    return new Response(
      JSON.stringify({
        message: `Cancellati ${eventsToDelete.length} eventi con successo`,
        deleted: eventsToDelete.length,
        events: eventsToDelete.map(e => ({ id: e.id, name: e.name, date: e.event_date }))
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
