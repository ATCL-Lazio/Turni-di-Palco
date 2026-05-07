-- Follow-up to 20260507120000_add_onboarding_completed_at.sql
-- Extends the onboarding_variant CHECK constraint to allow 'skipped_manual'
-- (user tapped "Salta" inside OnboardingFirstMission, distinct from the QR bypass).

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS onboarding_variant_check;

ALTER TABLE profiles
  ADD CONSTRAINT onboarding_variant_check
    CHECK (onboarding_variant IN ('full', 'skipped_qr', 'skipped_manual'));
