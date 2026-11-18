-- Ticket secrets: server-generated random ticket values and keyed redeem-code verifiers.
--
-- The ticket-activation edge function (action issue_ticket) now generates the
-- ticket value (the QR content, stored in ticket_activations.hash) at random and
-- a short redeem code for manual entry. Only a keyed verifier of the redeem code
-- is stored, never the code itself.
--
-- Additive and non-destructive. Direct client writes stay revoked
-- (see 20260821000000_turn_and_ticket_guards.sql); nothing is granted here.
--
-- Deploy order: 1) apply this migration, 2) deploy the ticket-activation edge
-- function, 3) release the app.
--
-- Rollback notes
--   * drop index if exists public.ticket_activations_circuit_event_ticket_unique;
--   * alter table public.ticket_activations drop column if exists redeem_code_verifier;
--   (Dropping the column makes tickets issued meanwhile fall back to the legacy
--   attendee_id rule for manual activation; QR activation keeps working.)

alter table public.ticket_activations
  add column if not exists redeem_code_verifier text;

-- One ticket number per circuit and event. If duplicates already exist the index
-- is skipped with a warning (so the migration does not fail) and must be handled
-- manually; the edge function also checks for an existing ticket before issuing.
do $$
begin
  if exists (
    select 1
    from public.ticket_activations
    group by circuit, event_id, ticket_number
    having count(*) > 1
  ) then
    raise warning 'ticket_activations has duplicate (circuit, event_id, ticket_number) rows: unique index not created';
  else
    create unique index if not exists ticket_activations_circuit_event_ticket_unique
      on public.ticket_activations (circuit, event_id, ticket_number);
  end if;
end
$$;
