import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, hash, payload, userId } = await req.json();

    if (action === 'reserve_hash') {
      if (!hash || !payload) {
        return new Response(JSON.stringify({ error: 'Missing hash or payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if hash already exists
      const { data: existing } = await supabase
        .from('ticket_activations')
        .select('hash')
        .eq('hash', hash)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ reserved: false, error: 'Hash already exists' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Insert new ticket activation record (unassigned)
      const { error: insertError } = await supabase.from('ticket_activations').insert({
        hash,
        circuit: payload.circuit,
        event_name: payload.eventName,
        event_id: payload.eventID,
        ticket_number: payload.ticketNumber,
        date: payload.date,
      });

      if (insertError) {
        throw insertError;
      }

      return new Response(JSON.stringify({ reserved: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'activate_hash' || action === 'activate_by_details') {
      if (!userId || (action === 'activate_hash' && !hash) || (action === 'activate_by_details' && (!payload?.eventID || !payload?.ticketNumber))) {
        return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Resolve hash if using details
      let targetHash = hash;
      if (action === 'activate_by_details') {
        const { data: ticket } = await supabase
          .from('ticket_activations')
          .select('hash')
          .eq('event_id', payload.eventID)
          .eq('ticket_number', payload.ticketNumber)
          .single();
        
        if (!ticket) {
          return new Response(JSON.stringify({ ok: false, error: 'Ticket non trovato.' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        targetHash = ticket.hash;
      }

      // 2. Atomic activation update
      const { data, error } = await supabase
        .from('ticket_activations')
        .update({
          activated_by: userId,
          activated_at: new Date().toISOString(),
        })
        .eq('hash', targetHash)
        .is('activated_by', null)
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Check current status if update failed
      const { data: current } = await supabase
        .from('ticket_activations')
        .select('activated_by')
        .eq('hash', targetHash)
        .single();

      if (!current) {
        return new Response(JSON.stringify({ ok: false, error: 'Ticket non trovato.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          ok: false,
          alreadyActivated: true,
          activatedBy: current.activated_by,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
