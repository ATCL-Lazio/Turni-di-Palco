# Supabase security inventory (PWA)

## PWA data access inventory

### RPC used by the PWA
- `public.get_leaderboard(p_limit int)` (used by `apps/pwa/src/leaderboard.ts`).

### Edge functions used by the PWA
- `dev-access` (enforces dev-only authorization server-side and logs access denials).

### Tables read by the RPC
- `public.profiles` (leaderboard profile fields).
- `public.turns` (aggregate count per profile).

### Other client-exposed tables/views (not referenced in PWA code)
- `public.roles`, `public.events`, `public.activities` (catalog data).
- `public.badges`, `public.user_badges` (badge data).
- `public.my_turn_stats`, `public.my_badges` (views granted to `authenticated`).

## RLS status check

RLS is enabled on every game table exposed to the client:
- `public.roles`
- `public.events`
- `public.activities`
- `public.profiles`
- `public.turns`
- `public.activity_completions`
- `public.badges`
- `public.user_badges`

## Policy summary (minimum access)

All policies are now explicitly scoped to the `authenticated` role:
- Read-only catalog tables (`roles`, `events`, `activities`, `badges`) allow `select` to `authenticated`.
- Ownership tables (`profiles`, `turns`, `activity_completions`, `user_badges`) allow `select/insert/update/delete` only for rows where `auth.uid()` matches the owner.
- RPCs (`get_leaderboard`, `reset_my_progress`, `evaluate_my_badges`, `mark_my_badges_seen`) are granted only to `authenticated`.
- `dev_access_audit` is written by the `dev-access` edge function using the service role key (RLS enabled).

## Anonymous access verification (manual)

Run these checks in a Supabase SQL editor or `psql` session as the `anon` role:

```sql
-- Expect: permission denied or RLS violation
select * from public.profiles limit 1;
select * from public.turns limit 1;

-- Expect: permission denied (RPC execution blocked)
select public.get_leaderboard(10);

-- Expect: permission denied
select * from public.badges limit 1;
```

### Expected outcome
- Anonymous users cannot read or write any rows from protected tables.
- Anonymous users cannot execute RPCs (leaderboard or progress reset).
