import { describe, expect, it } from 'vitest';
import { getMinigameConfig, isMinigameAvailableForRole } from '../gameplay/minigames';
import { MINIGAME_TARGET_RANGE } from '../../../../shared/config/balancing';

describe('minigames — target randomisation', () => {
  it('every target falls within MINIGAME_TARGET_RANGE', () => {
    const activityIds = ['ritardo', 'palco', 'audio', 'recitazione', 'copione', 'sequenza_luci', 'equalizzazione'];
    for (const id of activityIds) {
      const config = getMinigameConfig(id);
      for (const round of config.rounds) {
        expect(round.target).toBeGreaterThanOrEqual(MINIGAME_TARGET_RANGE.min);
        expect(round.target).toBeLessThanOrEqual(MINIGAME_TARGET_RANGE.max);
      }
    }
  });

  it('targets are integers', () => {
    const config = getMinigameConfig('ritardo');
    for (const round of config.rounds) {
      expect(Number.isInteger(round.target)).toBe(true);
    }
  });

  it('produces different targets across calls (probabilistic)', () => {
    const targets1 = getMinigameConfig('palco').rounds.map(r => r.target);
    // With 71^3 possible combinations the probability of two identical draws is negligible.
    let differs = false;
    for (let i = 0; i < 10; i++) {
      const t = getMinigameConfig('palco').rounds.map(r => r.target);
      if (t.some((v, idx) => v !== targets1[idx])) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  it('tolerance is still preserved after randomisation', () => {
    const config = getMinigameConfig('ritardo', null, { presence: 50, precision: 80, leadership: 50, creativity: 50 });
    // All tolerances must be ≥ 1 (stat-adjusted floor)
    for (const round of config.rounds) {
      expect(round.tolerance).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('minigames — isMinigameAvailableForRole', () => {
  it('unrestricted activities are available to everyone', () => {
    expect(isMinigameAvailableForRole('ritardo')).toBe(true);
    expect(isMinigameAvailableForRole('audio')).toBe(true);
  });

  it('restricted activities require the correct role', () => {
    expect(isMinigameAvailableForRole('sequenza_luci', 'luci')).toBe(true);
    expect(isMinigameAvailableForRole('sequenza_luci', 'fonico')).toBe(false);
    expect(isMinigameAvailableForRole('sequenza_luci')).toBe(false);
  });
});
