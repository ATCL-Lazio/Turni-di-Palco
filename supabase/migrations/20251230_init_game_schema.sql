create extension if not exists "pgcrypto";

create table if not exists public.roles (
  id text primary key,
  name text not null,
  focus text not null,
  stats jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  name text not null,
  theatre text not null,
  event_date text not null,
  event_time text not null,
  genre text not null,
  base_rewards jsonb not null,
  focus_role text references public.roles(id) on update cascade on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  title text not null,
  description text not null,
  duration text not null,
  xp_reward integer not null,
  cachet_reward integer not null,
  difficulty text not null check (difficulty in ('Facile', 'Medio', 'Difficile')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role_id text references public.roles(id) on update cascade on delete set null,
  level integer not null default 1,
  xp integer not null default 0,
  xp_to_next_level integer not null default 1000,
  xp_total integer not null default 0,
  xp_field integer not null default 0,
  reputation integer not null default 0,
  cachet integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text references public.events(id) on update cascade on delete set null,
  event_name text,
  theatre text,
  event_date text,
  event_time text,
  role_id text references public.roles(id) on update cascade on delete set null,
  rewards jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text references public.activities(id) on update cascade on delete set null,
  rewards jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists turns_user_id_idx on public.turns(user_id);
create index if not exists activity_completions_user_id_idx on public.activity_completions(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Player'),
    new.email,
    'attore'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.roles enable row level security;
alter table public.events enable row level security;
alter table public.activities enable row level security;
alter table public.profiles enable row level security;
alter table public.turns enable row level security;
alter table public.activity_completions enable row level security;

create policy "roles read" on public.roles
for select using (true);

create policy "events read" on public.events
for select using (true);

create policy "activities read" on public.activities
for select using (true);

create policy "profiles select own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles insert own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles update own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "turns select own" on public.turns
for select using (auth.uid() = user_id);

create policy "turns insert own" on public.turns
for insert with check (auth.uid() = user_id);

create policy "turns update own" on public.turns
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "turns delete own" on public.turns
for delete using (auth.uid() = user_id);

create policy "activity completions select own" on public.activity_completions
for select using (auth.uid() = user_id);

create policy "activity completions insert own" on public.activity_completions
for insert with check (auth.uid() = user_id);

create policy "activity completions update own" on public.activity_completions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "activity completions delete own" on public.activity_completions
for delete using (auth.uid() = user_id);

insert into public.roles (id, name, focus, stats)
values
  ('attore', 'Attore / Attrice', 'Presenza scenica', '{"presence":90,"precision":70,"leadership":60,"creativity":85}'),
  ('luci', 'Tecnico Luci', 'Precisione cue', '{"presence":50,"precision":95,"leadership":65,"creativity":75}'),
  ('fonico', 'Fonico', 'Pulizia audio', '{"presence":45,"precision":90,"leadership":60,"creativity":70}'),
  ('attrezzista', 'Attrezzista / Scenografo', 'Allestimento rapido', '{"presence":55,"precision":85,"leadership":70,"creativity":90}'),
  ('palco', 'Assistente di Palco', 'Coordinamento', '{"presence":60,"precision":88,"leadership":85,"creativity":65}')
on conflict (id) do update set
  name = excluded.name,
  focus = excluded.focus,
  stats = excluded.stats;

insert into public.events (id, name, theatre, event_date, event_time, genre, base_rewards, focus_role)
values
  ('ATCL-001', 'Prova aperta - Teatro di Latina', 'Teatro di Latina', '15 Dic 2025', '20:30', 'Drama', '{"xp":150,"reputation":25,"cachet":100}', 'attrezzista'),
  ('ATCL-002', 'Festival Giovani Voci', 'Teatro dell''Unione', '10 Gen 2026', '21:00', 'Musical', '{"xp":160,"reputation":30,"cachet":120}', 'fonico'),
  ('ATCL-003', 'Prima nazionale - Circuito ATCL', 'Teatro Palladium', '02 Feb 2026', '20:45', 'Opera', '{"xp":180,"reputation":35,"cachet":140}', 'luci')
on conflict (id) do update set
  name = excluded.name,
  theatre = excluded.theatre,
  event_date = excluded.event_date,
  event_time = excluded.event_time,
  genre = excluded.genre,
  base_rewards = excluded.base_rewards,
  focus_role = excluded.focus_role;

insert into public.activities (id, title, description, duration, xp_reward, cachet_reward, difficulty)
values
  ('ritardo', 'Prova generale in ritardo', 'La compagnia è in ritardo di 20 minuti. Devi gestire il clima e chiudere la prova.', '5 min', 50, 20, 'Medio'),
  ('audio', 'Prova audio critica', 'Un rientro micro crea Larsen. Il tempo stringe prima dell’apertura porte.', '6 min', 60, 25, 'Difficile'),
  ('palco', 'Cambio scena rapido', 'Il cambio scena tra due atti è più lento del previsto. Serve velocizzare.', '4 min', 55, 22, 'Medio'),
  ('recitazione', 'Prova di recitazione', 'Esercita le tue abilità di interpretazione con un monologo classico.', '5 min', 45, 18, 'Facile')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  duration = excluded.duration,
  xp_reward = excluded.xp_reward,
  cachet_reward = excluded.cachet_reward,
  difficulty = excluded.difficulty;
