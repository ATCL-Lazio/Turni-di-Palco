-- Harden RLS: add FORCE on all user-data tables and fill missing policies.
--
-- Current state (from prior migrations):
--   profiles              : ENABLE RLS, SELECT/INSERT/UPDATE  (missing DELETE, missing FORCE)
--   turns                 : ENABLE RLS, SELECT/INSERT/UPDATE/DELETE (missing FORCE)
--   activity_completions  : ENABLE RLS, SELECT/INSERT/UPDATE/DELETE (missing FORCE)
--   user_badges           : ENABLE RLS, SELECT/UPDATE          (missing INSERT/DELETE, missing FORCE)
--   planned_participations: ENABLE+FORCE RLS, SELECT/INSERT/UPDATE/DELETE (complete)

-- ============================================================
-- 1. FORCE ROW LEVEL SECURITY on tables that lack it
--    (ensures RLS applies even to table owners / superusers)
-- ============================================================
alter table public.profiles              force row level security;
alter table public.turns                 force row level security;
alter table public.activity_completions  force row level security;
alter table public.user_badges           force row level security;

-- ============================================================
-- 2. profiles — add DELETE own policy (needed for GDPR Art.17)
-- ============================================================
drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles delete own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

-- ============================================================
-- 3. user_badges — add INSERT own and DELETE own policies
--    INSERT: badges are normally awarded by security-definer
--    functions, but the policy ensures direct inserts are also
--    scoped to the authenticated user.
-- ============================================================
drop policy if exists "user badges insert own" on public.user_badges;
create policy "user badges insert own"
on public.user_badges
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "user badges delete own" on public.user_badges;
create policy "user badges delete own"
on public.user_badges
for delete
to authenticated
using ((select auth.uid()) = user_id);
