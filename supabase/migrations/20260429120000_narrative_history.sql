-- Issue #328 — Narrative history.
-- Persistent log of player choices in narrative scenes. Used for analytics and
-- to gate future scenes that depend on prior decisions.

create table if not exists public.narrative_history (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  scene_id     text not null,
  choice_id    text not null,
  rewards      jsonb not null default '{}'::jsonb,
  flags_set    text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create index if not exists narrative_history_user_idx
  on public.narrative_history (user_id, created_at desc);

create index if not exists narrative_history_scene_idx
  on public.narrative_history (scene_id);

-- Enable + force RLS so the table owner cannot bypass policies.
alter table public.narrative_history enable row level security;
alter table public.narrative_history force row level security;

drop policy if exists "narrative_history select own" on public.narrative_history;
create policy "narrative_history select own"
on public.narrative_history
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "narrative_history insert own" on public.narrative_history;
create policy "narrative_history insert own"
on public.narrative_history
for insert
to authenticated
with check (user_id = auth.uid());

-- No update / delete policies: history is append-only by design. GDPR Art. 17
-- erasure is covered by the on-delete cascade from auth.users.
