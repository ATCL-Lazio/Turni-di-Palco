-- Issue #472: FTUE onboarding tracking
-- Adds two nullable columns to profiles so the client can persist whether
-- a user completed (or skipped via QR) the first-run experience.
--
-- onboarding_completed_at: ISO timestamp set when the user finishes (or skips)
--                          the FTUE flow; NULL means onboarding not yet done.
-- onboarding_variant:      'full' = completed the first-mission screen;
--                          'skipped_qr' = bypassed via event QR deep-link.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_variant TEXT DEFAULT NULL
    CONSTRAINT onboarding_variant_check
      CHECK (onboarding_variant IN ('full', 'skipped_qr'));
