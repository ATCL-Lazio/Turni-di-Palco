/**
 * Catalogo corsi di formazione — Issue #327.
 *
 * Definisce tipi, costanti e il catalogo hardcoded (MVP).
 * In futuro il catalogo potrà essere caricato da Supabase.
 */

import { ACTIVITY_REWARDS } from '../../../../shared/config/balancing';

export type CourseSkill = 'precision' | 'presence' | 'creativity' | 'leadership';

export type Course = {
  id: string;
  title: string;
  description: string;
  /** Durata del corso in minuti (usata anche come "costo tempo"). */
  durationMinutes: number;
  /** Costo in cachet (può essere 0). */
  costCachet: number;
  /** Skill migliorata al completamento. */
  skill: CourseSkill;
  /** Punti skill guadagnati al completamento. */
  skillPoints: number;
};

/** Catalogo corsi hardcoded (MVP, in futuro da DB). */
export const COURSES_CATALOG: Course[] = [
  {
    id: 'course-tecnica-luci',
    title: 'Fondamenti di Tecnica Luci',
    description: 'Principi di illuminotecnica teatrale e uso del banco luci.',
    durationMinutes: 90,
    costCachet: 20,
    skill: 'precision',
    skillPoints: 5,
  },
  {
    id: 'course-regia-scene',
    title: 'Regia e Gestione Scena',
    description: 'Coordinamento degli attori e gestione dello spazio scenico.',
    durationMinutes: 120,
    costCachet: 30,
    skill: 'leadership',
    skillPoints: 5,
  },
  {
    id: 'course-sound-design',
    title: 'Sound Design per Teatro',
    description: 'Progettazione sonora e mixaggio live per spettacoli teatrali.',
    durationMinutes: 90,
    costCachet: 20,
    skill: 'creativity',
    skillPoints: 5,
  },
  {
    id: 'course-presenza-scena',
    title: 'Presenza Scenica',
    description: 'Tecniche di presenza e comunicazione non verbale sul palco.',
    durationMinutes: 60,
    costCachet: 15,
    skill: 'presence',
    skillPoints: 5,
  },
];

/** XP base assegnati al completamento di un corso (da balancing). */
export const COURSE_COMPLETION_XP = ACTIVITY_REWARDS.course_completion.xp.min; // 100

/** Cooldown in ms prima di poter rifare lo stesso corso (3 giorni). */
export const COURSE_COOLDOWN_MS =
  ACTIVITY_REWARDS.course_completion.cooldownMinutes * 60 * 1000;

/**
 * Restituisce un corso dal catalogo per ID, o undefined se non trovato.
 */
export function getCourseById(courseId: string): Course | undefined {
  return COURSES_CATALOG.find((c) => c.id === courseId);
}
