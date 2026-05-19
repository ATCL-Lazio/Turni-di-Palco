import { describe, expect, it } from 'vitest';
import {
  computeRewardBreakdown,
  getActiveStatBenefitsForActivity,
  getLeadershipPhaseTimeBonusSec,
  getPresenceComboBonus,
  getRoleStatPreviews,
  getTimingWindowBonus,
  isImproviseRoundUnlocked,
} from '../gameplay/role-effects';
import { STAT_EFFECTS } from '../../../../shared/config/balancing';

const STATS_BALANCED = { presence: 50, precision: 50, leadership: 50, creativity: 50 };
const STATS_LUCI = { presence: 40, precision: 90, leadership: 60, creativity: 30 };
const STATS_ATTORE = { presence: 95, precision: 35, leadership: 50, creativity: 70 };

describe('role-effects — pure helpers per stat (#471)', () => {
  it('senza stat ritorna sempre il valore neutro', () => {
    expect(getTimingWindowBonus(null)).toBe(0);
    expect(getPresenceComboBonus(undefined)).toBe(0);
    expect(getLeadershipPhaseTimeBonusSec(null)).toBe(0);
    expect(isImproviseRoundUnlocked(null)).toBe(false);
  });

  it('a baseline (tutte 50) nessun bonus si attiva', () => {
    expect(getTimingWindowBonus(STATS_BALANCED)).toBe(0);
    expect(getPresenceComboBonus(STATS_BALANCED)).toBe(0);
    expect(getLeadershipPhaseTimeBonusSec(STATS_BALANCED)).toBe(0);
    expect(isImproviseRoundUnlocked(STATS_BALANCED)).toBe(false);
  });

  it('Tecnico Luci (precision=90) ha timing più generoso', () => {
    // (90 - 50) * 4 = 160ms
    expect(getTimingWindowBonus(STATS_LUCI)).toBe(160);
  });

  it('Presence sopra la soglia sblocca il combo bonus', () => {
    expect(STATS_ATTORE.presence).toBeGreaterThanOrEqual(STAT_EFFECTS.presence.comboBonusThreshold);
    expect(getPresenceComboBonus(STATS_ATTORE)).toBe(STAT_EFFECTS.presence.comboBonusPerHit);
  });

  it('Creativity ≥ improviseRoundUnlockThreshold sblocca round bonus', () => {
    expect(isImproviseRoundUnlocked(STATS_ATTORE)).toBe(true);
    expect(isImproviseRoundUnlocked(STATS_LUCI)).toBe(false);
  });

  it('Leadership sotto soglia non dà time bonus', () => {
    expect(getLeadershipPhaseTimeBonusSec(STATS_BALANCED)).toBe(0);
  });

  it('Leadership ≥ multiPhaseTimeBonusThreshold dà time bonus', () => {
    const stats = { ...STATS_BALANCED, leadership: STAT_EFFECTS.leadership.multiPhaseTimeBonusThreshold };
    expect(getLeadershipPhaseTimeBonusSec(stats)).toBe(
      STAT_EFFECTS.leadership.multiPhaseTimeBonusSeconds,
    );
  });
});

describe('role-effects — computeRewardBreakdown (#471)', () => {
  it('senza stats ritorna le ricompense base immutate', () => {
    const result = computeRewardBreakdown({
      baseXp: 30,
      baseCachet: 10,
      activityId: 'audio',
      stats: null,
    });
    expect(result.finalXp).toBe(30);
    expect(result.finalCachet).toBe(10);
    expect(result.bonuses).toEqual([]);
  });

  it('precision alta applica bonus cachet sulle attività fonico', () => {
    const result = computeRewardBreakdown({
      baseXp: 30,
      baseCachet: 100,
      activityId: 'audio',
      stats: STATS_LUCI,
    });
    const cachetBonus = result.bonuses.find(b => b.source === 'precision' && b.kind === 'cachet');
    expect(cachetBonus).toBeDefined();
    expect(result.finalCachet).toBeGreaterThan(100);
  });

  it('precision NON si applica su attività palco', () => {
    const result = computeRewardBreakdown({
      baseXp: 30,
      baseCachet: 100,
      activityId: 'palco',
      stats: STATS_LUCI,
    });
    const cachetBonus = result.bonuses.find(b => b.source === 'precision');
    expect(cachetBonus).toBeUndefined();
  });

  it('cap +20% precisione: oltre 117 punti il moltiplicatore non cresce', () => {
    const result = computeRewardBreakdown({
      baseXp: 0,
      baseCachet: 1000,
      activityId: 'audio',
      stats: { ...STATS_LUCI, precision: 100 },
    });
    const bonus = result.bonuses.find(b => b.source === 'precision');
    expect(bonus?.multiplier).toBeLessThanOrEqual(1 + STAT_EFFECTS.precision.cachetMultCap + 1e-9);
  });

  it('leadership applica un bonus cachet GLOBALE, non solo a una famiglia', () => {
    const result = computeRewardBreakdown({
      baseXp: 50,
      baseCachet: 100,
      activityId: 'recitazione', // attività non legata a precision/creativity
      stats: { ...STATS_BALANCED, leadership: 100, presence: 100 },
    });
    const leadership = result.bonuses.find(b => b.source === 'leadership_global');
    expect(leadership).toBeDefined();
  });

  it('presence sopra baseline applica bonus XP a recitazione', () => {
    const result = computeRewardBreakdown({
      baseXp: 100,
      baseCachet: 30,
      activityId: 'recitazione',
      stats: STATS_ATTORE,
    });
    const xpBonus = result.bonuses.find(b => b.source === 'presence' && b.kind === 'xp');
    expect(xpBonus).toBeDefined();
    expect(result.finalXp).toBeGreaterThan(100);
  });
});

describe('role-effects — UI previews (#471)', () => {
  it('getRoleStatPreviews ritorna sempre 4 stat con label localizzata', () => {
    const previews = getRoleStatPreviews(STATS_LUCI);
    expect(previews).toHaveLength(4);
    expect(previews.map(p => p.stat).sort()).toEqual(
      ['creativity', 'leadership', 'precision', 'presence'],
    );
    for (const p of previews) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.effect.length).toBeGreaterThan(0);
    }
  });

  it('preview marca attive le stat sopra baseline e inattive le altre', () => {
    const previews = getRoleStatPreviews(STATS_LUCI);
    const precision = previews.find(p => p.stat === 'precision');
    const creativity = previews.find(p => p.stat === 'creativity');
    expect(precision?.active).toBe(true);
    expect(creativity?.active).toBe(false);
  });

  it('getActiveStatBenefitsForActivity: niente stats → array vuoto', () => {
    expect(getActiveStatBenefitsForActivity('audio', null)).toEqual([]);
  });

  it('precision attiva sui minigiochi fonico', () => {
    const result = getActiveStatBenefitsForActivity('audio', STATS_LUCI);
    const precision = result.find(b => b.stat === 'precision');
    expect(precision).toBeDefined();
  });

  it('precision NON attiva sui minigiochi palco', () => {
    const result = getActiveStatBenefitsForActivity('palco', STATS_LUCI);
    const precision = result.find(b => b.stat === 'precision');
    expect(precision).toBeUndefined();
  });

  it("ruolo con presence=20 (sotto baseline) non vede il bonus presence sulla recitazione", () => {
    const lowPresence = { ...STATS_BALANCED, presence: 20 };
    const result = getActiveStatBenefitsForActivity('recitazione', lowPresence);
    expect(result.find(b => b.stat === 'presence')).toBeUndefined();
  });
});
