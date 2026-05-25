-- Migration: add course state to profiles — Issue #327
--
-- Adds three JSONB columns to `profiles` so that player course progress
-- (skills, active courses, completed courses) is persisted server-side
-- and survives a page refresh or cross-device session.
--
-- Column semantics:
--   skills           — { precision, presence, creativity, leadership } point totals
--   active_courses   — { [courseId]: ISO-8601 start timestamp }
--   completed_courses— { [courseId]: ISO-8601 completion timestamp }
--
-- All three default to '{}' (empty object) so existing rows don't break.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills           jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active_courses   jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS completed_courses jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.skills IS
  'Player skill point totals — {precision, presence, creativity, leadership}. Updated server-side on course completion.';
COMMENT ON COLUMN public.profiles.active_courses IS
  'Courses currently in progress — {courseId: ISO-8601 startedAt}. Cleared on completion.';
COMMENT ON COLUMN public.profiles.completed_courses IS
  'Courses that have been completed — {courseId: ISO-8601 completedAt}. Used for cooldown enforcement.';
