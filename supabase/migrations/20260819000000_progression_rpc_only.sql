-- Progressione: scritture solo tramite RPC SECURITY DEFINER (issue #1677)
--
-- turns e activity_completions non sono piu' scrivibili direttamente dai client:
-- le ricompense sono calcolate lato server da register_turn_with_token_boost e
-- complete_activity_with_slots (entrambe SECURITY DEFINER, idempotenti su
-- client_action_id). I trigger AFTER INSERT sono SECURITY DEFINER e continuano a
-- funzionare. La lettura (select own) resta invariata.
--
-- Prerequisito: il client non deve piu' fare insert diretti (vedi store.tsx,
-- kind legacy 'turn_insert' ora instradato sulla RPC).
--
-- Rollback: ricreare le policy
--   create policy "turns insert own" on public.turns for insert to authenticated with check (auth.uid() = user_id);
--   create policy "turns update own" on public.turns for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
--   (idem per activity_completions con i nomi "activity completions insert own" / "activity completions update own")
-- e fare grant insert, update sulle due tabelle a authenticated.

drop policy if exists "turns insert own" on public.turns;
drop policy if exists "turns update own" on public.turns;
drop policy if exists "activity completions insert own" on public.activity_completions;
drop policy if exists "activity completions update own" on public.activity_completions;

revoke insert, update, delete, truncate on public.turns from anon, authenticated;
revoke insert, update, delete, truncate on public.activity_completions from anon, authenticated;
