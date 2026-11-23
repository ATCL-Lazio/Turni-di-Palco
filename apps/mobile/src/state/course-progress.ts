/**
 * Logica pura dei corsi formativi (Issue #327), estratta da store.tsx.
 *
 * Le funzioni `check*` validano un'azione contro uno snapshot del profilo; le
 * funzioni `apply*` calcolano il profilo successivo e vanno usate sia per il
 * persist sia dentro l'updater di setState (closes #1378, #1547).
 */

import {
  COURSES_CATALOG,
  COURSE_COMPLETION_XP,
  COURSE_COOLDOWN_MS,
  type Course,
  type CourseSkill,
} from '../gameplay/courses';
import { applyRewards } from './rewards';
import type { PlayerProfile, Rewards } from './types';

export type CourseCheckResult = { ok: true; course: Course } | { ok: false; error: string };

export type CourseCompletionReward = {
  xpGained: number;
  skillGained: CourseSkill;
  pointsGained: number;
};

const EMPTY_SKILLS: PlayerProfile['skills'] = { precision: 0, presence: 0, creativity: 0, leadership: 0 };

function findCourse(courseId: string): Course | undefined {
  return COURSES_CATALOG.find((c) => c.id === courseId);
}

/** Valida l'avvio di un corso: esistenza, già attivo, cooldown e cachet. */
export function checkCourseStart(profile: PlayerProfile, courseId: string, now: number): CourseCheckResult {
  const course = findCourse(courseId);
  if (!course) return { ok: false, error: 'Corso non trovato.' };

  const completedCourses = profile.completedCourses ?? {};
  const activeCourses = profile.activeCourses ?? {};

  if (activeCourses[courseId]) {
    return { ok: false, error: 'Corso già in corso.' };
  }

  const lastCompleted = completedCourses[courseId];
  if (lastCompleted) {
    const elapsed = now - new Date(lastCompleted).getTime();
    if (elapsed < COURSE_COOLDOWN_MS) {
      const remainingMs = COURSE_COOLDOWN_MS - elapsed;
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
      return {
        ok: false,
        error: `Corso in cooldown. Disponibile tra ${remainingHours} ore.`,
      };
    }
  }

  if (profile.cachet < course.costCachet) {
    return {
      ok: false,
      error: `Cachet insufficiente. Necessari: ${course.costCachet}, disponibili: ${profile.cachet}.`,
    };
  }

  return { ok: true, course };
}

/** Profilo dopo l'avvio del corso: scala il cachet e segna il corso come attivo. */
export function applyCourseStart(profile: PlayerProfile, course: Course, startedAt: string): PlayerProfile {
  return {
    ...profile,
    // Clamp to 0: the guard uses the render-time snapshot, so a concurrent
    // mutation could reduce cachet below costCachet before the setState
    // updater runs, causing a negative balance (closes #1410).
    cachet: Math.max(0, profile.cachet - course.costCachet),
    skills: profile.skills ?? EMPTY_SKILLS,
    completedCourses: profile.completedCourses ?? {},
    activeCourses: { ...(profile.activeCourses ?? {}), [course.id]: startedAt },
  };
}

/** Durata minima di un corso: 10 secondi in DEV, `durationMinutes` in produzione. */
export function getCourseRequiredMs(course: Course, isDev: boolean): number {
  return isDev ? 10 * 1000 : course.durationMinutes * 60 * 1000;
}

/** Valida il completamento di un corso: esistenza, avviato e tempo trascorso. */
export function checkCourseCompletion(
  profile: PlayerProfile,
  courseId: string,
  now: number,
  isDev: boolean,
): CourseCheckResult {
  const course = findCourse(courseId);
  if (!course) return { ok: false, error: 'Corso non trovato.' };

  const startedAt = (profile.activeCourses ?? {})[courseId];
  if (!startedAt) {
    return { ok: false, error: 'Corso non avviato.' };
  }

  const requiredMs = getCourseRequiredMs(course, isDev);
  const elapsed = now - new Date(startedAt).getTime();
  if (elapsed < requiredMs) {
    const remainingSec = Math.ceil((requiredMs - elapsed) / 1000);
    return {
      ok: false,
      error: `Corso non ancora completato. Tempo rimanente: ${remainingSec} secondi.`,
    };
  }

  return { ok: true, course };
}

/** Ricompense assegnate al completamento di un corso. */
export function getCourseCompletionReward(course: Course): CourseCompletionReward {
  return {
    xpGained: COURSE_COMPLETION_XP,
    skillGained: course.skill,
    pointsGained: course.skillPoints,
  };
}

/** Profilo dopo il completamento: XP, punti skill e spostamento tra attivi/completati. */
export function applyCourseCompletion(profile: PlayerProfile, course: Course, completedAt: string): PlayerProfile {
  const { xpGained, skillGained, pointsGained } = getCourseCompletionReward(course);
  const skills = profile.skills ?? EMPTY_SKILLS;
  const activeCourses = profile.activeCourses ?? {};
  const completedCourses = profile.completedCourses ?? {};

  // Applica XP tramite lo stesso helper usato dalle attività.
  const courseRewards: Rewards = { xp: xpGained, cachet: 0, reputation: 0 };
  const profileWithXp = applyRewards(profile, courseRewards, 'activity');

  const updatedSkills = {
    ...skills,
    [skillGained]: (skills[skillGained] ?? 0) + pointsGained,
  };

  const { [course.id]: _removed, ...remainingActive } = activeCourses;

  return {
    ...profileWithXp,
    skills: updatedSkills,
    completedCourses: { ...completedCourses, [course.id]: completedAt },
    activeCourses: remainingActive,
  };
}
