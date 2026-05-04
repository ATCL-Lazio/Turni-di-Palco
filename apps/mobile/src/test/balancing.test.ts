import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_REWARDS,
  LEVEL_PROGRESSION,
  STAT_EFFECTS,
  getLeadershipCachetMultiplier,
  getStatMultiplier,
  getXpToNextLevel,
} from '../../../../shared/config/balancing';

describe('balancing — activity rewards table', () => {
  it('exposes a spec for every kind defined in #475', () => {
    const expected = [
      'narrative_scene',
      'minigame_completion',
      'minigame_perfect',
      'course_completion',
    ];
    expect(Object.keys(ACTIVITY_REWARDS).sort()).toEqual(expected.sort());
  });

  it('keeps min ≤ max on every reward range', () => {
    for (const spec of Object.values(ACTIVITY_REWARDS)) {
      expect(spec.xp.min).toBeLessThanOrEqual(spec.xp.max);
      expect(spec.cachet.min).toBeLessThanOrEqual(spec.cachet.max);
      expect(spec.cooldownMinutes).toBeGreaterThan(0);
    }
  });

  it('matches the headline numbers from the GDD table', () => {
    expect(ACTIVITY_REWARDS.narrative_scene.cooldownMinutes).toBe(360);
    expect(ACTIVITY_REWARDS.minigame_perfect.xp.max).toBe(80);
    expect(ACTIVITY_REWARDS.course_completion.cachet.max).toBe(0);
    expect(ACTIVITY_REWARDS.course_completion.cooldownMinutes).toBe(3 * 24 * 60);
  });
});

describe('balancing — getXpToNextLevel', () => {
  it('mirrors the curve currently used by store.applyRewards', () => {
    // store.tsx uses `800 + level * 200` after a level-up; sample known points.
    expect(getXpToNextLevel(1)).toBe(1000);
    expect(getXpToNextLevel(5)).toBe(1800);
    expect(getXpToNextLevel(10)).toBe(2800);
  });

  it('never drops below the floor for invalid input', () => {
    expect(getXpToNextLevel(0)).toBe(LEVEL_PROGRESSION.baseXpToNextLevel);
    expect(getXpToNextLevel(-5)).toBe(LEVEL_PROGRESSION.baseXpToNextLevel);
    expect(getXpToNextLevel(Number.NaN)).toBe(LEVEL_PROGRESSION.baseXpToNextLevel);
  });

  it('grows monotonically with level', () => {
    let previous = -Infinity;
    for (let lvl = 1; lvl <= 50; lvl += 1) {
      const value = getXpToNextLevel(lvl);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('balancing — getStatMultiplier', () => {
  it('returns 1 when the stat is at or below baseline', () => {
    expect(getStatMultiplier('precision', 'cachet', 50)).toBe(1);
    expect(getStatMultiplier('precision', 'cachet', 30)).toBe(1);
    expect(getStatMultiplier('presence', 'xp', 49)).toBe(1);
    expect(getStatMultiplier('creativity', 'xp', 0)).toBe(1);
  });

  it('grants the per-point bonus above baseline', () => {
    // precision: +0.3% cachet per point above 50.
    expect(getStatMultiplier('precision', 'cachet', 60)).toBeCloseTo(1.03, 5);
    // presence: +0.4% xp per point above 50.
    expect(getStatMultiplier('presence', 'xp', 60)).toBeCloseTo(1.04, 5);
    // creativity: +0.3% xp per point above 50.
    expect(getStatMultiplier('creativity', 'xp', 70)).toBeCloseTo(1.06, 5);
  });

  it('never exceeds the configured cap, even with absurd stat values', () => {
    // With per-point coefficients from #471 the linear bonus at stat=100
    // (delta=50) is below the cap for precision/creativity; the cap acts as
    // a safety net should the curve be retuned upward later.
    expect(getStatMultiplier('precision', 'cachet', 999)).toBeCloseTo(
      1 + STAT_EFFECTS.precision.cachetMultCap,
      5,
    );
    expect(getStatMultiplier('presence', 'xp', 999)).toBeCloseTo(
      1 + STAT_EFFECTS.presence.xpMultCap,
      5,
    );
    expect(getStatMultiplier('creativity', 'xp', 999)).toBeCloseTo(
      1 + STAT_EFFECTS.creativity.xpMultCap,
      5,
    );
  });

  it('reaches the natural maximum of the linear bonus at stat=100', () => {
    // delta = 50; per-point coefficients from STAT_EFFECTS.
    expect(getStatMultiplier('precision', 'cachet', 100)).toBeCloseTo(1.15, 5);
    expect(getStatMultiplier('presence', 'xp', 100)).toBeCloseTo(1.2, 5);
    expect(getStatMultiplier('creativity', 'xp', 100)).toBeCloseTo(1.15, 5);
  });

  it('returns 1 for unsupported axis/kind combinations', () => {
    expect(getStatMultiplier('precision', 'xp', 100)).toBe(1);
    expect(getStatMultiplier('presence', 'cachet', 100)).toBe(1);
    expect(getStatMultiplier('creativity', 'cachet', 100)).toBe(1);
  });
});

describe('balancing — getLeadershipCachetMultiplier', () => {
  it('returns 1 below baseline', () => {
    expect(getLeadershipCachetMultiplier(20)).toBe(1);
    expect(getLeadershipCachetMultiplier(50)).toBe(1);
  });

  it('grants +0.2% per point above baseline', () => {
    expect(getLeadershipCachetMultiplier(60)).toBeCloseTo(1.02, 5);
  });

  it('caps at +10%', () => {
    expect(getLeadershipCachetMultiplier(100)).toBeCloseTo(
      1 + STAT_EFFECTS.leadership.cachetMultCap,
      5,
    );
  });
});
