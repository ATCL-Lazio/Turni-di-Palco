-- Dynamic narrative scene generation.
-- Stores AI-generated narrative scenes produced by the generate-narrative-scene
-- Edge Function. Each row is tied to the requesting user; RLS limits reads to
-- the owner. Inserts are performed by the Edge Function via the service role key
-- so that server-side validation runs before any data reaches the table.

create table if not exists public.generated_narrative_scenes (
  id            text        primary key,            -- 'maxwell_<uuid>'
  user_id       uuid        not null references auth.users(id) on delete cascade,
  role_id       text        not null,
  scene         jsonb       not null,               -- full NarrativeScene JSON
  source        text        not null default 'maxwell',
  generated_at  timestamptz not null default now(),
  expires_at    timestamptz                         -- null = no expiry
);

create index if not exists generated_narrative_scenes_user_idx
  on public.generated_narrative_scenes (user_id, generated_at desc);

alter table public.generated_narrative_scenes enable row level security;
alter table public.generated_narrative_scenes force row level security;

-- Users may read only their own generated scenes.
drop policy if exists "generated_narrative_scenes select own" on public.generated_narrative_scenes;
create policy "generated_narrative_scenes select own"
  on public.generated_narrative_scenes
  for select
  to authenticated
  using (user_id = auth.uid());

-- No INSERT policy for the authenticated role: rows are inserted exclusively
-- by the Edge Function using the service role key, which ensures the scene JSON
-- has been validated and rewards have been computed before persistence.
