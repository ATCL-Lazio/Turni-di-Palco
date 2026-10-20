import type { PlayerProfile } from './types';

/** Returns true if the user has already completed (or skipped) the FTUE onboarding. */
export function selectIsOnboarded(profile: Pick<PlayerProfile, 'onboardingCompletedAt'>): boolean {
  return profile.onboardingCompletedAt !== null;
}
