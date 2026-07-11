-- Migration: Add cleanup_expired_events RPC for atomic transactional deletion
-- Created: 2026-07-11
-- Closes: #1434
--
-- The cleanup-events edge function previously issued two sequential DELETEs
-- (ticket_activations, then events) as separate Supabase client calls.
-- If the second DELETE failed after the first committed, the DB was left in a
-- corrupt state (orphaned ticket_activations rows deleted, events still present).
-- This RPC wraps both DELETEs inside a single PL/pgSQL function, which
-- PostgreSQL executes within one implicit transaction, guaranteeing atomicity.

CREATE OR REPLACE FUNCTION public.cleanup_expired_events(event_ids text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove child rows first to satisfy the FK constraint on ticket_activations.event_id.
  -- (ticket_activations also has ON DELETE CASCADE, but we delete explicitly here
  -- so both operations share the same transaction and any failure rolls back both.)
  DELETE FROM public.ticket_activations WHERE event_id = ANY(event_ids);

  -- Remove the parent event rows. The planned_participations FK already carries
  -- ON DELETE CASCADE, so those child rows are handled automatically by Postgres.
  DELETE FROM public.events WHERE id = ANY(event_ids);
END;
$$;

-- Restrict execution to the service role used by edge functions.
REVOKE ALL ON FUNCTION public.cleanup_expired_events(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_events(text[]) TO service_role;
