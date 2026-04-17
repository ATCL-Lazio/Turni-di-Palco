-- Migration: Create ticket_activations table for Issue #52
-- Created: 2026-02-11

create table if not exists public.ticket_activations (
  hash text primary key, -- SHA-256 hash of the ticket payload
  circuit text not null,
  event_name text not null,
  event_id text not null references public.events(id) on update cascade on delete cascade,
  ticket_number text not null,
  date timestamptz not null,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  
  -- Ensure that if activated_by is set, activated_at is also set
  constraint ticket_activations_activation_consistency check (
    (activated_by is null and activated_at is null)
    or (activated_by is not null and activated_at is not null)
  )
);

-- Indices for performance
create index if not exists ticket_activations_event_id_idx on public.ticket_activations(event_id);
create index if not exists ticket_activations_activated_by_idx on public.ticket_activations(activated_by) where activated_by is not null;

-- Enable RLS
alter table public.ticket_activations enable row level security;
alter table public.ticket_activations force row level security;

-- Policies

-- 1. Everyone (authenticated) can see their own activations
create policy "Users can see their own ticket activations"
on public.ticket_activations
for select
to authenticated
using (auth.uid() = activated_by);

-- 2. Operators/Admins can see everything (using the role system from control_plane)
-- If control_plane_has_any_role exists (it does from previous migration)
create policy "Operators and admins can see all ticket activations"
on public.ticket_activations
for select
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin', 'control_operator', 'control_auditor']::text[])
);

-- 3. Insert is restricted to service role (Edge Function) by default if no policy allows it.
-- We want to allow the Edge Function to manage this table.
-- Usually service role bypasses RLS, so we don't need a specific 'for insert' policy unless 
-- we want to allow users to reserve their own (which we don't, the operator tool does it).

-- 4. Update policy for activation (allowing a user to activate a ticket that belongs to NO ONE)
create policy "Users can activate an unassigned ticket"
on public.ticket_activations
for update
to authenticated
using (activated_by is null)
with check (auth.uid() = activated_by);

-- Note: The Edge Function will handle the atomic check-and-set for activation to be safe.
