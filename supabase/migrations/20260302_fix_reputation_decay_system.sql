-- Fix reputation decay system - Issue #117
-- Adds missing columns, tables and functions for ATCL reputation decay

-- Add missing columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_activity_slots integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_reputation_decay_at date;

-- Create theatre reputation adjustments table
CREATE TABLE IF NOT EXISTS public.theatre_reputation_adjustments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theatre text NOT NULL,
  adjustment integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  last_decay_at date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, theatre)
);

CREATE INDEX IF NOT EXISTS theatre_reputation_adjustments_user_idx
  ON public.theatre_reputation_adjustments(user_id);

-- Create cachet ledger table
CREATE TABLE IF NOT EXISTS public.cachet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (
    reason IN (
      'earn_turn',
      'earn_activity',
      'spend_shop',
      'manual_adjust'
    )
  ),
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cachet_ledger_user_created_idx
  ON public.cachet_ledger(user_id, created_at DESC);

-- Create shop catalog table
CREATE TABLE IF NOT EXISTS public.shop_catalog (
  code text PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('slot', 'rep_atcl', 'rep_theatre')),
  currency text NOT NULL DEFAULT 'cachet' CHECK (currency = 'cachet'),
  cost_cachet integer NOT NULL CHECK (cost_cachet > 0),
  effect_value integer NOT NULL CHECK (effect_value > 0),
  max_purchases_per_user integer CHECK (max_purchases_per_user IS NULL OR max_purchases_per_user > 0),
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create shop purchases table
CREATE TABLE IF NOT EXISTS public.shop_purchases (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_code text NOT NULL REFERENCES public.shop_catalog(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  target_theatre text,
  status text NOT NULL CHECK (status IN ('applied', 'rejected')),
  rejection_reason text,
  cost_cachet integer NOT NULL CHECK (cost_cachet >= 0),
  effect jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_purchases_user_created_idx
  ON public.shop_purchases(user_id, created_at DESC);

-- Enable RLS on new tables
ALTER TABLE public.cachet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cachet_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shop_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_purchases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.theatre_reputation_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theatre_reputation_adjustments FORCE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "cachet ledger select own" ON public.cachet_ledger;
CREATE POLICY "cachet ledger select own"
ON public.cachet_ledger
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shop catalog read active" ON public.shop_catalog;
CREATE POLICY "shop catalog read active"
ON public.shop_catalog
FOR SELECT
TO authenticated
USING (active = true);

DROP POLICY IF EXISTS "shop purchases select own" ON public.shop_purchases;
CREATE POLICY "shop purchases select own"
ON public.shop_purchases
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "theatre reputation adjustments select own" ON public.theatre_reputation_adjustments;
CREATE POLICY "theatre reputation adjustments select own"
ON public.theatre_reputation_adjustments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create reputation decay function
CREATE OR REPLACE FUNCTION public.apply_daily_reputation_decay(
  p_today date DEFAULT current_date
)
RETURNS table (
  decayed_profiles integer,
  decayed_theatres integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profiles_count integer := 0;
  v_theatres_count integer := 0;
BEGIN
  -- Process profiles that need decay
  UPDATE public.profiles p
  SET 
    reputation = GREATEST(0, p.reputation - 5),
    last_reputation_decay_at = p_today
  WHERE p.last_activity_at IS NOT NULL
    AND (p_today - (p.last_activity_at AT TIME ZONE 'Europe/Rome')::date) > 3
    AND (
      p.last_reputation_decay_at IS NULL 
      OR p.last_reputation_decay_at < p_today
    );
  
  GET DIAGNOSTICS v_profiles_count = ROW_COUNT;
  
  -- Process theatre reputations that need decay
  UPDATE public.theatre_reputation_adjustments tra
  SET 
    adjustment = GREATEST(-100, tra.adjustment - 5),
    last_decay_at = p_today
  WHERE (p_today - (tra.last_activity_at AT TIME ZONE 'Europe/Rome')::date) > 3
    AND (
      tra.last_decay_at IS NULL 
      OR tra.last_decay_at < p_today
    );
  
  GET DIAGNOSTICS v_theatres_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_profiles_count, v_theatres_count;
END;
$$;

-- Grant permissions
REVOKE EXECUTE ON FUNCTION public.apply_daily_reputation_decay(date) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_daily_reputation_decay(date) TO service_role;

-- Set up cron job (if pg_cron extension is available)
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron extension not available. Job must be configured manually.';
    RETURN;
  END IF;

  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'tdp_reputation_decay_daily'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'tdp_reputation_decay_daily',
    '5 3 * * *',
    'SELECT public.apply_daily_reputation_decay();'
  );
  
  RAISE NOTICE 'Reputation decay cron job scheduled successfully.';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available. Install with: CREATE EXTENSION pg_cron;';
END;
$$;
