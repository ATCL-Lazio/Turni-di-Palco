/**
 * Passive-skill reward bonus (#121).
 *
 * Verifies the shared multiplier helper and that training a skill above the
 * baseline raises the reward a turn/activity grants — the link that ties
 * "completing a course increases a skill" to "the bonus is reflected in a
 * calculation". The server SQL (public.skill_reward_multipliers, applied in
 * 20260615100000/20260615110000) mirrors this same math.
 */

import { describe, expect, it } from 'vitest';
import {
  computeSkillRewardMultipliers,
  type SkillStats,
} from '../../../../shared/config/balancing';
import { COURSES_CATALOG } from '../gameplay/courses';
import { computeTurnRewards, type GameEvent, type RoleId } from '../state/store';

const BASELINE: SkillStats = { precision: 50, presence: 50, creativity: 50, leadership: 50 };

describe('computeSkillRewardMultipliers', () => {
  it('is neutral at/below baseline and for missing skills', () => {
    expect(computeSkillRewardMultipliers(BASELINE)).toEqual({ xpMult: 1, cachetMult: 1 });
    expect(computeSkillRewardMultipliers(null)).toEqual({ xpMult: 1, cachetMult: 1 });
    expect(computeSkillRewardMultipliers({ ...BASELINE, presence: 0 })).toEqual({
      xpMult: 1,
      cachetMult: 1,
    });
  });

  it('routes presence/creativity to xp and precision/leadership to cachet', () => {
    const presence = computeSkillRewardMultipliers({ ...BASELINE, presence: 100 });
    expect(presence.xpMult).toBeGreaterThan(1);
    expect(presence.cachetMult).toBe(1);

    const precision = computeSkillRewardMultipliers({ ...BASELINE, precision: 100 });
    expect(precision.cachetMult).toBeGreaterThan(1);
    expect(precision.xpMult).toBe(1);
  });

  it('caps each axis (presence +20%, creativity +20%, precision +20%, leadership +10%)', () => {
    const maxed = computeSkillRewardMultipliers({
      precision: 1000,
      presence: 1000,
      creativity: 1000,
      leadership: 1000,
    });
    // xp cap: 1.20 * 1.20 = 1.44 ; cachet cap: 1.20 * 1.10 = 1.32
    expect(maxed.xpMult).toBeCloseTo(1.44, 5);
    expect(maxed.cachetMult).toBeCloseTo(1.32, 5);
  });
});

describe('computeTurnRewards — passive-skill bonus (#121)', () => {
  const event: GameEvent = {
    id: 'evt-1',
    name: 'Prima',
    theatre: 'Spazio Rossellini',
    date: '01 Feb 2026',
    time: '21:00',
    genre: 'Prosa',
    baseRewards: { xp: 100, cachet: 40, reputation: 9 },
    focusRole: 'luci',
  } as GameEvent;
  const role: RoleId = 'attore'; // not the focus role → no focus bonus, isolates the skill effect

  it('leaves rewards unchanged at baseline / without skills', () => {
    const base = computeTurnRewards(event, role);
    expect(base).toEqual({ xp: 100, cachet: 40, reputation: 9 });
    expect(computeTurnRewards(event, role, BASELINE)).toEqual(base);
  });

  it('raises xp and cachet when skills exceed the baseline', () => {
    const trained = computeTurnRewards(event, role, {
      precision: 100,
      presence: 100,
      creativity: 100,
      leadership: 100,
    });
    expect(trained.xp).toBeGreaterThan(100);
    expect(trained.cachet).toBeGreaterThan(40);
    // reputation is never affected by skills
    expect(trained.reputation).toBe(9);
  });

  it('reflects a completed course: the trained skill increases the reward', () => {
    // A course raises one skill by skillPoints; starting from the neutral
    // baseline, that should push the matching reward dimension above the base.
    const course = COURSES_CATALOG[0];
    const after: SkillStats = { ...BASELINE, [course.skill]: 50 + course.skillPoints };

    const base = computeTurnRewards(event, role, BASELINE);
    const boosted = computeTurnRewards(event, role, after);

    const xpAxis = course.skill === 'presence' || course.skill === 'creativity';
    if (xpAxis) {
      expect(boosted.xp).toBeGreaterThan(base.xp);
    } else {
      expect(boosted.cachet).toBeGreaterThan(base.cachet);
    }
  });
});
