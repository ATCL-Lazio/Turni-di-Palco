-- Fix #433: sync performance for users with many turns
-- 1. Composite index for ordered per-user queries
CREATE INDEX IF NOT EXISTS turns_user_created_at_idx
  ON public.turns(user_id, created_at DESC);

-- 2. Refactor my_turn_stats to use a single table scan instead of 3 sub-SELECTs
CREATE OR REPLACE VIEW public.my_turn_stats AS
SELECT
  user_id,
  COUNT(*)::int AS total_turns,
  COUNT(*) FILTER (
    WHERE created_at >= date_trunc('month', now())
      AND created_at < date_trunc('month', now()) + INTERVAL '1 month'
  )::int AS turns_this_month,
  COUNT(DISTINCT theatre) FILTER (
    WHERE theatre IS NOT NULL AND theatre <> ''
  )::int AS unique_theatres
FROM public.turns
WHERE user_id = auth.uid()
GROUP BY user_id;

-- Re-grant select so existing permissions are preserved
GRANT SELECT ON public.my_turn_stats TO authenticated;
