/**
 * Test di unità per la logica pura dei corsi estratta da store.tsx (Issue #327).
 */

import { describe, expect, it } from 'vitest';
import { COURSES_CATALOG, COURSE_COMPLETION_XP, COURSE_COOLDOWN_MS } from '../gameplay/courses';
import { createDefaultState } from '../state/persistence';
import {
  applyCourseCompletion,
  applyCourseStart,
  checkCourseCompletion,
  checkCourseStart,
  getCourseRequiredMs,
} from '../state/course-progress';
import type { PlayerProfile } from '../state/types';

const course = COURSES_CATALOG[0];
const NOW = Date.parse('2026-11-23T12:00:00.000Z');

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    ...createDefaultState().profile,
    cachet: 1_000,
    skills: { precision: 0, presence: 0, creativity: 0, leadership: 0 },
    activeCourses: {},
    completedCourses: {},
    ...overrides,
  };
}

describe('checkCourseStart', () => {
  it('rifiuta un corso inesistente', () => {
    expect(checkCourseStart(profile(), 'nope', NOW)).toEqual({ ok: false, error: 'Corso non trovato.' });
  });

  it('rifiuta un corso già attivo', () => {
    const p = profile({ activeCourses: { [course.id]: new Date(NOW).toISOString() } });
    expect(checkCourseStart(p, course.id, NOW)).toEqual({ ok: false, error: 'Corso già in corso.' });
  });

  it('rifiuta un corso in cooldown indicando le ore residue', () => {
    const completedAt = new Date(NOW - COURSE_COOLDOWN_MS + 60 * 60 * 1000).toISOString();
    const result = checkCourseStart(profile({ completedCourses: { [course.id]: completedAt } }), course.id, NOW);
    expect(result).toEqual({ ok: false, error: 'Corso in cooldown. Disponibile tra 1 ore.' });
  });

  it('rifiuta se il cachet non basta', () => {
    const result = checkCourseStart(profile({ cachet: 0 }), course.id, NOW);
    expect(result.ok).toBe(false);
  });

  it('accetta un corso valido', () => {
    const result = checkCourseStart(profile(), course.id, NOW);
    expect(result).toEqual({ ok: true, course });
  });
});

describe('applyCourseStart', () => {
  it('scala il cachet senza andare sotto zero e segna il corso come attivo', () => {
    const next = applyCourseStart(profile({ cachet: 1 }), course, 'start');
    expect(next.cachet).toBe(0);
    expect(next.activeCourses[course.id]).toBe('start');
  });
});

describe('checkCourseCompletion', () => {
  it('rifiuta un corso non avviato', () => {
    expect(checkCourseCompletion(profile(), course.id, NOW, false)).toEqual({
      ok: false,
      error: 'Corso non avviato.',
    });
  });

  it('rifiuta se il tempo minimo non è trascorso', () => {
    const p = profile({ activeCourses: { [course.id]: new Date(NOW - 5_000).toISOString() } });
    expect(checkCourseCompletion(p, course.id, NOW, true)).toEqual({
      ok: false,
      error: 'Corso non ancora completato. Tempo rimanente: 5 secondi.',
    });
  });

  it('accetta dopo la durata richiesta', () => {
    const startedAt = new Date(NOW - getCourseRequiredMs(course, false)).toISOString();
    const p = profile({ activeCourses: { [course.id]: startedAt } });
    expect(checkCourseCompletion(p, course.id, NOW, false)).toEqual({ ok: true, course });
  });
});

describe('applyCourseCompletion', () => {
  it('assegna XP e punti skill e sposta il corso tra i completati', () => {
    const p = profile({ activeCourses: { [course.id]: 'start', other: 'x' } });
    const next = applyCourseCompletion(p, course, 'done');
    expect(next.skills[course.skill]).toBe(course.skillPoints);
    expect(next.activeCourses).toEqual({ other: 'x' });
    expect(next.completedCourses[course.id]).toBe('done');
    expect(next.xpTotal).toBe(p.xpTotal + COURSE_COMPLETION_XP);
  });
});
