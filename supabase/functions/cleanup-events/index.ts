/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const url = new URL(req.url)
    const daysToKeep = parseInt(url.searchParams.get('days') || '7')
    
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
    
  } catch (error: any) {
    console.error('❌ Errore durante la pulizia:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
