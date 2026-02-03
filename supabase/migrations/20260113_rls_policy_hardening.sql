alter policy "roles read" on public.roles
  to authenticated
  using (true);

alter policy "events read" on public.events
  to authenticated
  using (true);

alter policy "activities read" on public.activities
  to authenticated
  using (true);

alter policy "profiles select own" on public.profiles
  to authenticated
  using ((select auth.uid()) = id);

alter policy "profiles insert own" on public.profiles
  to authenticated
  with check ((select auth.uid()) = id);

alter policy "profiles update own" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "turns select own" on public.turns
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "turns insert own" on public.turns
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "turns update own" on public.turns
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "turns delete own" on public.turns
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "activity completions select own" on public.activity_completions
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "activity completions insert own" on public.activity_completions
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "activity completions update own" on public.activity_completions
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "activity completions delete own" on public.activity_completions
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "badges read" on public.badges
  to authenticated
  using (true);

alter policy "user badges select own" on public.user_badges
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "user badges update own" on public.user_badges
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke select on public.badges from anon;

grant select on public.badges to authenticated;
