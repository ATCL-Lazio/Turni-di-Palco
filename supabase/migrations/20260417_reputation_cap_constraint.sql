-- Issue #528 — enforce reputation cap at the database layer
--
-- RPCs already clamp reputation to [0,100] via least()/greatest(), but the
-- column itself accepted any integer, which meant a stray UPDATE (direct SQL,
-- future edge function, misconfigured policy) could push it past the intended
-- 0..100 range. Add a CHECK constraint so the cap is enforced server-side
-- regardless of the write path.

-- Clamp any existing out-of-range rows before adding the constraint, so the
-- migration is idempotent even if test data drifted above 100 or below 0.
UPDATE public.profiles
   SET reputation = LEAST(100, GREATEST(0, reputation))
 WHERE reputation < 0 OR reputation > 100;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_reputation_range_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reputation_range_check
  CHECK (reputation BETWEEN 0 AND 100);
