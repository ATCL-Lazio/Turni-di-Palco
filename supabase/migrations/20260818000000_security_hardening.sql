-- Security hardening (audit 2026-11-18)
--
-- 1. Le colonne economiche di profiles non sono scrivibili dal client.
-- 2. theatres: abilita RLS (sola lettura per i client).
-- 3. Niente delete diretto su turns / activity_completions / user_badges
--    (si usa reset_my_progress, SECURITY DEFINER) e niente insert diretto su
--    user_badges / token_redemptions.
-- 4. Funzioni riservate a service_role non eseguibili da anon/authenticated.
-- 5. Limiti server-side sul bucket profile-images.
--
-- Rollback: ricreare le policy rimosse (vedi 20251230_init_game_schema.sql,
-- 20260224_token_atcl_foundation.sql, 20260413120000_enable_rls.sql).

-- ---------------------------------------------------------------------------
-- 1. profiles: guard sulle colonne economiche
-- ---------------------------------------------------------------------------
-- REVOKE UPDATE (colonna) non ha effetto finche' il ruolo ha il grant UPDATE
-- sull'intera tabella (default Supabase). Il trigger invece vale sempre per le
-- richieste dirette dei client (current_user = authenticated/anon) e lascia
-- passare le funzioni SECURITY DEFINER e service_role.
create or replace function public.guard_profile_economy_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.level := 1;
      new.xp := 0;
      new.xp_to_next_level := 1000;
      new.xp_total := 0;
      new.xp_field := 0;
      new.reputation := 0;
      new.cachet := 0;
      new.token_atcl := 0;
    else
      new.level := old.level;
      new.xp := old.xp;
      new.xp_to_next_level := old.xp_to_next_level;
      new.xp_total := old.xp_total;
      new.xp_field := old.xp_field;
      new.reputation := old.reputation;
      new.cachet := old.cachet;
      new.token_atcl := old.token_atcl;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_economy_columns on public.profiles;
create trigger guard_profile_economy_columns
before insert or update on public.profiles
for each row execute function public.guard_profile_economy_columns();

-- ---------------------------------------------------------------------------
-- 2. theatres: RLS (geofence config modificabile solo da service_role)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.theatres') is not null then
    execute 'alter table public.theatres enable row level security';
    execute 'drop policy if exists "theatres select all" on public.theatres';
    execute 'create policy "theatres select all" on public.theatres for select to anon, authenticated using (true)';
    execute 'revoke insert, update, delete, truncate on public.theatres from anon, authenticated';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Scritture dirette sulle tabelle di progressione
-- ---------------------------------------------------------------------------
drop policy if exists "turns delete own" on public.turns;
drop policy if exists "activity completions delete own" on public.activity_completions;
drop policy if exists "user badges insert own" on public.user_badges;
drop policy if exists "user badges delete own" on public.user_badges;
drop policy if exists "token redemptions insert own" on public.token_redemptions;

revoke delete on public.turns from anon, authenticated;
revoke delete on public.activity_completions from anon, authenticated;
revoke insert, delete on public.user_badges from anon, authenticated;
revoke insert on public.token_redemptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Funzioni riservate: REVOKE FROM PUBLIC non toglie i grant di default
--    che Supabase assegna ad anon/authenticated.
-- ---------------------------------------------------------------------------
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'cleanup_expired_events',
        'apply_daily_reputation_decay',
        'trigger_edge_import',
        'evaluate_badges_for_user',
        'grant_passive_skill_xp'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Bucket profile-images: limiti applicati dal server, non solo dal client
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'profile-images';
