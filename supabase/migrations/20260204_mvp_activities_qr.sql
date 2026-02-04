alter table public.activities
  add column if not exists reputation_reward integer,
  add column if not exists minigame_type text,
  add column if not exists cooldown_seconds integer,
  add column if not exists max_runs_per_session integer;

update public.activities
set
  reputation_reward = coalesce(reputation_reward, 5),
  minigame_type = coalesce(nullif(minigame_type, ''), 'timing'),
  cooldown_seconds = coalesce(cooldown_seconds, 60),
  max_runs_per_session = coalesce(max_runs_per_session, 3);

alter table public.activities
  alter column reputation_reward set default 5,
  alter column reputation_reward set not null,
  alter column minigame_type set default 'timing',
  alter column minigame_type set not null,
  alter column cooldown_seconds set default 60,
  alter column cooldown_seconds set not null,
  alter column max_runs_per_session set default 3,
  alter column max_runs_per_session set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'activities_minigame_type_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_minigame_type_check
      check (minigame_type in ('timing', 'audio', 'memory', 'placement', 'rapid', 'priority'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'activities_cooldown_seconds_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_cooldown_seconds_check
      check (cooldown_seconds >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'activities_max_runs_per_session_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_max_runs_per_session_check
      check (max_runs_per_session >= 1);
  end if;
end;
$$;

create table if not exists public.activity_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id) on update cascade on delete cascade,
  runs_count_session integer not null default 0,
  session_started_at timestamptz,
  last_played_at timestamptz,
  best_score integer,
  last_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id),
  constraint activity_progress_runs_count_session_check check (runs_count_session >= 0),
  constraint activity_progress_best_score_check check (best_score is null or (best_score between 0 and 100)),
  constraint activity_progress_last_score_check check (last_score is null or (last_score between 0 and 100))
);

create index if not exists activity_progress_user_id_idx on public.activity_progress(user_id);
create index if not exists activity_progress_activity_id_idx on public.activity_progress(activity_id);

alter table public.activity_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_progress'
      and policyname = 'activity progress select own'
  ) then
    create policy "activity progress select own" on public.activity_progress
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_progress'
      and policyname = 'activity progress insert own'
  ) then
    create policy "activity progress insert own" on public.activity_progress
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_progress'
      and policyname = 'activity progress update own'
  ) then
    create policy "activity progress update own" on public.activity_progress
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_progress'
      and policyname = 'activity progress delete own'
  ) then
    create policy "activity progress delete own" on public.activity_progress
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end;
$$;

grant select, insert, update, delete on public.activity_progress to authenticated;

drop trigger if exists set_activity_progress_updated_at on public.activity_progress;
create trigger set_activity_progress_updated_at
before update on public.activity_progress
for each row execute function public.set_updated_at();

alter table public.activity_completions
  add column if not exists score integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'activity_completions_score_check'
      and conrelid = 'public.activity_completions'::regclass
  ) then
    alter table public.activity_completions
      add constraint activity_completions_score_check
      check (score is null or (score between 0 and 100));
  end if;
end;
$$;

create table if not exists public.qr_validation_nonces (
  nonce text primary key,
  event_id text not null references public.events(id) on update cascade on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists qr_validation_nonces_event_id_idx on public.qr_validation_nonces(event_id);
create index if not exists qr_validation_nonces_expires_at_idx on public.qr_validation_nonces(expires_at);

alter table public.qr_validation_nonces enable row level security;

create table if not exists public.qr_validation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_id text references public.events(id) on update cascade on delete set null,
  source text not null,
  status text not null,
  reason text,
  code_hash text,
  created_at timestamptz not null default now(),
  constraint qr_validation_logs_source_check check (source in ('fixed', 'hmac')),
  constraint qr_validation_logs_status_check check (status in ('accepted', 'rejected'))
);

create index if not exists qr_validation_logs_user_id_idx on public.qr_validation_logs(user_id);
create index if not exists qr_validation_logs_created_at_idx on public.qr_validation_logs(created_at desc);

alter table public.qr_validation_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'qr_validation_logs'
      and policyname = 'qr validation logs select own'
  ) then
    create policy "qr validation logs select own" on public.qr_validation_logs
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end;
$$;

grant select on public.qr_validation_logs to authenticated;

insert into public.activities (
  id,
  title,
  description,
  duration,
  xp_reward,
  cachet_reward,
  difficulty,
  reputation_reward,
  minigame_type,
  cooldown_seconds,
  max_runs_per_session
)
values
  ('ritardo', 'Prova generale in ritardo', 'La compagnia e in ritardo di 20 minuti. Devi gestire il clima e chiudere la prova.', '5 min', 50, 20, 'Medio', 6, 'timing', 60, 3),
  ('audio', 'Prova audio critica', 'Un rientro micro crea Larsen. Il tempo stringe prima dell''apertura porte.', '6 min', 60, 25, 'Difficile', 7, 'audio', 60, 3),
  ('palco', 'Cambio scena rapido', 'Il cambio scena tra due atti e piu lento del previsto. Serve velocizzare.', '4 min', 55, 22, 'Medio', 6, 'timing', 60, 3),
  ('recitazione', 'Prova di recitazione', 'Esercita le tue abilita di interpretazione con un monologo classico.', '5 min', 45, 18, 'Facile', 5, 'timing', 60, 3),
  ('luci_cue', 'Tempismo cue luci', 'Allinea le chiamate luci al ritmo scena senza perdere il tempo d''ingresso.', '4 min', 52, 21, 'Medio', 6, 'timing', 60, 3),
  ('monitor_mix', 'Mix monitor di palco', 'Bilancia i monitor per cast e musicisti in una situazione ad alta pressione.', '5 min', 58, 24, 'Medio', 7, 'audio', 60, 3),
  ('microfoni_wireless', 'Setup microfoni wireless', 'Sincronizza canali e livelli evitando interferenze durante il pre-show.', '6 min', 62, 26, 'Difficile', 8, 'audio', 60, 3),
  ('line_check', 'Line check finale', 'Controlla il segnale di ogni linea audio poco prima dell''apertura sala.', '4 min', 48, 19, 'Facile', 5, 'audio', 60, 3),
  ('memory_blocking', 'Memoria blocking scena', 'Ricostruisci la sequenza di movimenti del cast in ordine corretto.', '5 min', 57, 22, 'Medio', 6, 'memory', 60, 3),
  ('prop_placement', 'Posizionamento props', 'Posiziona gli oggetti di scena nelle aree corrette prima dell''ingresso attori.', '4 min', 54, 21, 'Medio', 6, 'placement', 60, 3),
  ('rapid_reset', 'Sprint reset palco', 'Completa un reset tecnico rapido tra due scene con tempi strettissimi.', '3 min', 50, 20, 'Facile', 5, 'rapid', 60, 3),
  ('cue_priority', 'Priorita cue regia', 'Ordina correttamente i cue critici per evitare errori durante la replica.', '5 min', 64, 28, 'Difficile', 8, 'priority', 60, 3)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  duration = excluded.duration,
  xp_reward = excluded.xp_reward,
  cachet_reward = excluded.cachet_reward,
  difficulty = excluded.difficulty,
  reputation_reward = excluded.reputation_reward,
  minigame_type = excluded.minigame_type,
  cooldown_seconds = excluded.cooldown_seconds,
  max_runs_per_session = excluded.max_runs_per_session;

create or replace function public.reset_my_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  delete from public.turns where user_id = v_user_id;
  delete from public.activity_completions where user_id = v_user_id;
  delete from public.activity_progress where user_id = v_user_id;
  delete from public.user_badges where user_id = v_user_id;
  delete from public.qr_validation_logs where user_id = v_user_id;
  delete from public.qr_validation_nonces where user_id = v_user_id;

  update public.profiles
  set
    role_id = 'attore',
    level = 1,
    xp = 0,
    xp_to_next_level = 1000,
    xp_total = 0,
    xp_field = 0,
    reputation = 0,
    cachet = 0
  where id = v_user_id;
end;
$$;

revoke execute on function public.reset_my_progress() from public;
grant execute on function public.reset_my_progress() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'activity_progress'
    ) then
      alter publication supabase_realtime add table public.activity_progress;
    end if;
  end if;
end;
$$;
