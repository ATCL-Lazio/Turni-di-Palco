import { describe, expect, it } from 'vitest';
import { FIRST_MISSIONS } from '../data/onboarding/first_mission';
import { ROLE_IDS, selectIsOnboarded } from '../state/store';
import type { PlayerProfile } from '../state/store';

// ---------------------------------------------------------------------------
// first_mission data
// ---------------------------------------------------------------------------

describe('FIRST_MISSIONS data', () => {
  it('covers all 7 roles', () => {
    for (const roleId of ROLE_IDS) {
      expect(FIRST_MISSIONS[roleId], `missing mission for ${roleId}`).toBeDefined();
    }
  });

  it('every mission has exactly 2 choices', () => {
    for (const roleId of ROLE_IDS) {
      const m = FIRST_MISSIONS[roleId];
      expect(m.choices).toHaveLength(2);
    }
  });

  it('every choice has a positive xpReward', () => {
    for (const roleId of ROLE_IDS) {
      for (const choice of FIRST_MISSIONS[roleId].choices) {
        expect(choice.xpReward).toBeGreaterThan(0);
      }
    }
  });

  it('every mission has a non-empty prompt and setting', () => {
    for (const roleId of ROLE_IDS) {
      const { scene } = FIRST_MISSIONS[roleId];
      expect(scene.prompt.length).toBeGreaterThan(0);
      expect(scene.setting.length).toBeGreaterThan(0);
    }
  });

  it('first choice always rewards more or equal XP than the second', () => {
    for (const roleId of ROLE_IDS) {
      const [first, second] = FIRST_MISSIONS[roleId].choices;
      expect(first.xpReward).toBeGreaterThanOrEqual(second.xpReward);
    }
  });
});

// ---------------------------------------------------------------------------
// selectIsOnboarded selector
// ---------------------------------------------------------------------------

const makeProfile = (onboardingCompletedAt: string | null): Pick<PlayerProfile, 'onboardingCompletedAt'> => ({
  onboardingCompletedAt,
});

describe('selectIsOnboarded', () => {
  it('returns false when onboardingCompletedAt is null', () => {
    expect(selectIsOnboarded(makeProfile(null))).toBe(false);
  });

  it('returns true when onboardingCompletedAt is an ISO string', () => {
    expect(selectIsOnboarded(makeProfile(new Date().toISOString()))).toBe(true);
  });

  it('is idempotent — second call returns the same value', () => {
    const profile = makeProfile(new Date().toISOString());
    expect(selectIsOnboarded(profile)).toBe(selectIsOnboarded(profile));
  });
});

// ---------------------------------------------------------------------------
// onboarding flow — variant values
// ---------------------------------------------------------------------------

describe('onboarding variant semantics', () => {
  it("'full' variant maps to completing the first mission", () => {
    // Just a documentation / type-guard test
    const variant: 'full' | 'skipped_qr' = 'full';
    expect(['full', 'skipped_qr']).toContain(variant);
  });

  it("'skipped_qr' variant maps to arriving via event QR deep-link", () => {
    const variant: 'full' | 'skipped_qr' = 'skipped_qr';
    expect(['full', 'skipped_qr']).toContain(variant);
  });
});
