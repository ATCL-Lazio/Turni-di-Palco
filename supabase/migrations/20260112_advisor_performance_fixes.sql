create index if not exists activity_completions_activity_id_idx on public.activity_completions (activity_id);
create index if not exists events_focus_role_idx on public.events (focus_role);
create index if not exists profiles_role_id_idx on public.profiles (role_id);
create index if not exists turns_event_id_idx on public.turns (event_id);
create index if not exists turns_role_id_idx on public.turns (role_id);
create index if not exists user_badges_badge_id_idx on public.user_badges (badge_id);

-- Remove unused index flagged by advisors.
drop index if exists public.followed_events_event_id_idx;

alter policy "activity completions select own" on public.activity_completions
  using ((select auth.uid()) = user_id);

alter policy "activity completions insert own" on public.activity_completions
  with check ((select auth.uid()) = user_id);

alter policy "activity completions update own" on public.activity_completions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "activity completions delete own" on public.activity_completions
  using ((select auth.uid()) = user_id);

alter policy "followed events select own" on public.followed_events
  using ((select auth.uid()) = user_id);

alter policy "followed events insert own" on public.followed_events
  with check ((select auth.uid()) = user_id);

alter policy "followed events delete own" on public.followed_events
  using ((select auth.uid()) = user_id);

alter policy "profiles select own" on public.profiles
  using ((select auth.uid()) = id);

alter policy "profiles insert own" on public.profiles
  with check ((select auth.uid()) = id);

alter policy "profiles update own" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "turns select own" on public.turns
  using ((select auth.uid()) = user_id);

alter policy "turns insert own" on public.turns
  with check ((select auth.uid()) = user_id);

alter policy "turns update own" on public.turns
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "turns delete own" on public.turns
  using ((select auth.uid()) = user_id);

alter policy "user badges select own" on public.user_badges
  using ((select auth.uid()) = user_id);

alter policy "user badges update own" on public.user_badges
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
