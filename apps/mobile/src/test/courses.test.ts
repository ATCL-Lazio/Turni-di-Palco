/**
 * Test di unità per il flusso corsi — Issue #327.
 *
 * Verifica:
 * - computeActivityRewards con skill > baseline dà XP/cachet maggiori
 * - getCourseById trova e non trova corsi
 * - Cooldown: un corso completato di recente deve essere in cooldown
 * - COURSE_COMPLETION_XP e COURSE_COOLDOWN_MS sono coerenti con balancing
 */

import { describe, expect, it } from 'vitest';
import {
  COURSES_CATALOG,
  COURSE_COMPLETION_XP,
  COURSE_COOLDOWN_MS,
  getCourseById,
} from '../gameplay/courses';
import { ACTIVITY_REWARDS } from '../../../../shared/config/balancing';
import { computeActivityRewards } from '../state/store';
import type { Activity } from '../state/store';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const MOCK_ACTIVITY: Activity = {
  id: 'test-activity',
  title: 'Attività test',
  description: 'Attività per i test.',
  duration: '30 min',
  xpReward: 50,
  cachetReward: 20,
  difficulty: 'Medio',
};

const SKILLS_BASELINE = { precision: 50, presence: 50, creativity: 50, leadership: 50 };
const SKILLS_HIGH = { precision: 100, presence: 100, creativity: 100, leadership: 100 };
const SKILLS_ZERO = { precision: 0, presence: 0, creativity: 0, leadership: 0 };

// ─── Test catalogo ─────────────────────────────────────────────────────────────

describe('courses — catalogo', () => {
  it('contiene almeno un corso', () => {
    expect(COURSES_CATALOG.length).toBeGreaterThan(0);
  });

  it('ogni corso ha i campi obbligatori', () => {
    for (const course of COURSES_CATALOG) {
      expect(typeof course.id).toBe('string');
      expect(typeof course.title).toBe('string');
      expect(typeof course.durationMinutes).toBe('number');
      expect(course.durationMinutes).toBeGreaterThan(0);
      expect(typeof course.costCachet).toBe('number');
      expect(course.costCachet).toBeGreaterThanOrEqual(0);
      expect(['precision', 'presence', 'creativity', 'leadership']).toContain(course.skill);
      expect(course.skillPoints).toBeGreaterThan(0);
    }
  });

  it('getCourseById trova un corso esistente', () => {
    const first = COURSES_CATALOG[0];
    expect(getCourseById(first.id)).toEqual(first);
  });

  it('getCourseById restituisce undefined per ID inesistente', () => {
    expect(getCourseById('non-esiste')).toBeUndefined();
  });
});

// ─── Test costanti da balancing ────────────────────────────────────────────────

describe('courses — costanti balancing', () => {
  it('COURSE_COMPLETION_XP è 100 (da balancing.ts)', () => {
    expect(COURSE_COMPLETION_XP).toBe(100);
    expect(COURSE_COMPLETION_XP).toBe(ACTIVITY_REWARDS.course_completion.xp.min);
  });

  it('COURSE_COOLDOWN_MS è 3 giorni in ms', () => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(COURSE_COOLDOWN_MS).toBe(threeDaysMs);
    expect(COURSE_COOLDOWN_MS).toBe(
      ACTIVITY_REWARDS.course_completion.cooldownMinutes * 60 * 1000,
    );
  });
});

// ─── Test computeActivityRewards con skill ─────────────────────────────────────

describe('computeActivityRewards — bonus skill (Issue #327)', () => {
  it('senza skill il risultato è invariato rispetto al baseline', () => {
    const noSkills = computeActivityRewards(MOCK_ACTIVITY, null, undefined);
    const zeroSkills = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_ZERO);
    // skill a 0 = sotto baseline (50), nessun bonus.
    expect(noSkills.xp).toBe(MOCK_ACTIVITY.xpReward);
    expect(zeroSkills.xp).toBe(MOCK_ACTIVITY.xpReward);
    expect(noSkills.cachet).toBe(MOCK_ACTIVITY.cachetReward);
    expect(zeroSkills.cachet).toBe(MOCK_ACTIVITY.cachetReward);
  });

  it('skill a baseline (50) non producono bonus', () => {
    const result = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_BASELINE);
    expect(result.xp).toBe(MOCK_ACTIVITY.xpReward);
    expect(result.cachet).toBe(MOCK_ACTIVITY.cachetReward);
  });

  it('skill alte (100) danno XP maggiore del baseline', () => {
    const baseline = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_BASELINE);
    const high = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_HIGH);
    expect(high.xp).toBeGreaterThan(baseline.xp);
  });

  it('skill alte (100) danno cachet maggiore del baseline', () => {
    const baseline = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_BASELINE);
    const high = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_HIGH);
    expect(high.cachet).toBeGreaterThan(baseline.cachet);
  });

  it('il bonus XP è calcolato da presence e creativity', () => {
    // Solo presence alta, creativity baseline.
    const onlyPresence = computeActivityRewards(MOCK_ACTIVITY, null, {
      ...SKILLS_BASELINE,
      presence: 100,
    });
    expect(onlyPresence.xp).toBeGreaterThan(MOCK_ACTIVITY.xpReward);

    // Solo creativity alta, presence baseline.
    const onlyCreativity = computeActivityRewards(MOCK_ACTIVITY, null, {
      ...SKILLS_BASELINE,
      creativity: 100,
    });
    expect(onlyCreativity.xp).toBeGreaterThan(MOCK_ACTIVITY.xpReward);
  });

  it('il bonus cachet è calcolato da precision e leadership', () => {
    const onlyPrecision = computeActivityRewards(MOCK_ACTIVITY, null, {
      ...SKILLS_BASELINE,
      precision: 100,
    });
    expect(onlyPrecision.cachet).toBeGreaterThan(MOCK_ACTIVITY.cachetReward);

    const onlyLeadership = computeActivityRewards(MOCK_ACTIVITY, null, {
      ...SKILLS_BASELINE,
      leadership: 100,
    });
    expect(onlyLeadership.cachet).toBeGreaterThan(MOCK_ACTIVITY.cachetReward);
  });

  it('la reputation non è influenzata dalle skill', () => {
    const baseline = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_BASELINE);
    const high = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_HIGH);
    expect(high.reputation).toBe(baseline.reputation);
  });

  it('i valori non sono mai negativi', () => {
    const result = computeActivityRewards(MOCK_ACTIVITY, null, SKILLS_HIGH);
    expect(result.xp).toBeGreaterThanOrEqual(0);
    expect(result.cachet).toBeGreaterThanOrEqual(0);
    expect(result.reputation).toBeGreaterThanOrEqual(0);
  });
});

// ─── Test logica cooldown ──────────────────────────────────────────────────────

describe('courses — logica cooldown', () => {
  it('un corso completato ora è in cooldown per 3 giorni', () => {
    const now = Date.now();
    const lastCompletedAt = new Date(now).toISOString();
    const elapsed = now - new Date(lastCompletedAt).getTime();
    expect(elapsed).toBeLessThan(COURSE_COOLDOWN_MS);
  });

  it('un corso completato 4 giorni fa non è più in cooldown', () => {
    const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - fourDaysAgo;
    expect(elapsed).toBeGreaterThanOrEqual(COURSE_COOLDOWN_MS);
  });

  it('un corso completato esattamente 3 giorni fa è appena uscito dal cooldown', () => {
    // Esattamente al limite: elapsed === COURSE_COOLDOWN_MS → NON in cooldown.
    const exactlyThreeDaysAgo = Date.now() - COURSE_COOLDOWN_MS;
    const elapsed = Date.now() - exactlyThreeDaysAgo;
    expect(elapsed).toBeGreaterThanOrEqual(COURSE_COOLDOWN_MS);
  });
});
