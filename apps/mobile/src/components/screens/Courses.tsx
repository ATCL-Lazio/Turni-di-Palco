/**
 * Schermata corsi di formazione — Issue #327.
 *
 * Mostra il catalogo corsi con stato (disponibile/in corso/cooldown),
 * le skill attuali del giocatore e i pulsanti di avvio/completamento.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Clock,
  Coins,
  TrendingUp,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { Screen } from '../ui/Screen';
import { ProgressBar } from '../ui/ProgressBar';
import {
  COURSES_CATALOG,
  COURSE_COOLDOWN_MS,
  type Course,
  type CourseSkill,
} from '../../gameplay/courses';
import { PlayerProfile, useGameState } from '../../state/store';

// ─── Tipi locali ─────────────────────────────────────────────────────────────

type CourseStatus =
  | { kind: 'available' }
  | { kind: 'active'; startedAt: Date; remainingMs: number }
  | { kind: 'cooldown'; availableAt: Date; remainingMs: number }
  | { kind: 'no_cachet' };

// ─── Helper ──────────────────────────────────────────────────────────────────

function getCourseStatus(
  course: Course,
  profile: PlayerProfile,
  now: number,
): CourseStatus {
  const skills = profile.skills ?? { precision: 0, presence: 0, creativity: 0, leadership: 0 };
  const activeCourses = profile.activeCourses ?? {};
  const completedCourses = profile.completedCourses ?? {};

  const startedAt = activeCourses[course.id];
  if (startedAt) {
    const startMs = new Date(startedAt).getTime();
    const elapsed = now - startMs;
    // In DEV il tempo minimo è 10 s; in produzione durationMinutes.
    const requiredMs = import.meta.env.DEV
      ? 10 * 1000
      : course.durationMinutes * 60 * 1000;
    const remainingMs = Math.max(0, requiredMs - elapsed);
    return { kind: 'active', startedAt: new Date(startMs), remainingMs };
  }

  const lastCompleted = completedCourses[course.id];
  if (lastCompleted) {
    const completedMs = new Date(lastCompleted).getTime();
    const elapsed = now - completedMs;
    if (elapsed < COURSE_COOLDOWN_MS) {
      const remainingMs = COURSE_COOLDOWN_MS - elapsed;
      return {
        kind: 'cooldown',
        availableAt: new Date(completedMs + COURSE_COOLDOWN_MS),
        remainingMs,
      };
    }
  }

  if (profile.cachet < course.costCachet) {
    return { kind: 'no_cachet' };
  }

  // Sopprime warning TS per skills non usato direttamente qui.
  void skills;

  return { kind: 'available' };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 sec';
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec} sec`;
  const minutes = Math.floor(totalSec / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  if (remainingMin === 0) return `${hours} h`;
  return `${hours} h ${remainingMin} min`;
}

const SKILL_LABELS: Record<CourseSkill, string> = {
  precision: 'Precisione',
  presence: 'Presenza',
  creativity: 'Creatività',
  leadership: 'Leadership',
};

const SKILL_COLORS: Record<CourseSkill, string> = {
  precision: '#4fa0f4',
  presence: '#a82847',
  creativity: '#f4bf4f',
  leadership: '#4fc87a',
};

// ─── Componente principale ───────────────────────────────────────────────────

interface CoursesProps {
  embedded?: boolean;
}

export function Courses({ embedded = false }: CoursesProps) {
  const { state, startCourse, completeCourse } = useGameState();
  const profile = state.profile;
  const [now, setNow] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<string | null>(null);

  // Aggiorna l'orologio ogni secondo per mostrare i progressi in tempo reale.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-clear feedback con cleanup al rimontaggio per evitare state updates
  // su componenti smontati e cancellazioni inattese del feedback.
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleStart = useCallback(
    (courseId: string) => {
      const result = startCourse(courseId);
      if (result.ok) {
        setFeedback('Corso avviato con successo!');
      } else {
        setFeedback(result.error);
      }
    },
    [startCourse],
  );

  const handleComplete = useCallback(
    (courseId: string) => {
      const result = completeCourse(courseId);
      if (result.ok) {
        setFeedback(
          `Corso completato! +${result.xpGained} XP, +${result.pointsGained} ${SKILL_LABELS[result.skillGained]}`,
        );
      } else {
        setFeedback(result.error);
      }
    },
    [completeCourse],
  );

  const skills = profile.skills ?? {
    precision: 0,
    presence: 0,
    creativity: 0,
    leadership: 0,
  };

  const content = (
    <>
      <header className="space-y-2">
        <h2 className="text-white">Corsi di Formazione</h2>
        <p className="text-[#b8b2b3]">
          Investi tempo e cachet per migliorare le tue skill
        </p>
      </header>

      {/* Skill attuali */}
      <SkillsCard skills={skills} />

      {/* Feedback messaggio */}
      {feedback && (
        <div className="rounded-xl bg-[#241f20] border border-[#a82847]/40 px-4 py-3 text-sm text-white">
          {feedback}
        </div>
      )}

      {/* Lista corsi */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white">Corsi disponibili</h3>
          <Tag size="sm" variant="info">{COURSES_CATALOG.length} corsi</Tag>
        </div>

        <div className="space-y-3">
          {COURSES_CATALOG.map((course) => {
            const status = getCourseStatus(course, profile, now);
            return (
              <CourseCard
                key={course.id}
                course={course}
                status={status}
                onStart={() => handleStart(course.id)}
                onComplete={() => handleComplete(course.id)}
              />
            );
          })}
        </div>
      </section>
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return <Screen contentClassName="px-6 pt-6 pb-8 space-y-6">{content}</Screen>;
}

// ─── Sotto-componenti ────────────────────────────────────────────────────────

function SkillsCard({
  skills,
}: {
  skills: { precision: number; presence: number; creativity: number; leadership: number };
}) {
  const entries = (Object.entries(skills) as [CourseSkill, number][]).sort(
    ([a], [b]) => a.localeCompare(b),
  );

  return (
    <Card className="border border-[#2d2728] bg-[#1a1617]">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-[#f4bf4f]" />
        <h3 className="text-white text-sm font-semibold">Le tue skill</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {entries.map(([skill, value]) => (
          <div key={skill} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#b8b2b3]">{SKILL_LABELS[skill]}</span>
              <span
                className="text-xs font-semibold"
                style={{ color: SKILL_COLORS[skill] }}
              >
                {value}
              </span>
            </div>
            <ProgressBar
              value={Math.min(value, 100)}
              max={100}
              color="gold"
              size="sm"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function CourseCard({
  course,
  status,
  onStart,
  onComplete,
}: {
  course: Course;
  status: CourseStatus;
  onStart: () => void;
  onComplete: () => void;
}) {
  const skillColor = SKILL_COLORS[course.skill];
  const skillLabel = SKILL_LABELS[course.skill];

  return (
    <Card className="border border-white/5 bg-gradient-to-br from-[#1a1617] via-[#1d1819] to-[#221d1e]">
      <div className="flex items-start gap-4">
        {/* Icona */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${skillColor}33, ${skillColor}11)` }}
        >
          <BookOpen size={22} style={{ color: skillColor }} />
        </div>

        <div className="flex-1 space-y-3">
          {/* Intestazione */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">
                {skillLabel} · +{course.skillPoints} punti
              </p>
              <h4 className="text-white text-base font-semibold leading-tight">
                {course.title}
              </h4>
            </div>
            <CourseStatusBadge status={status} />
          </div>

          {/* Descrizione */}
          <p className="text-sm text-[#b8b2b3]">{course.description}</p>

          {/* Metadati */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#b8b2b3]">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} />
              {course.durationMinutes} min
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Coins size={13} />
              {course.costCachet === 0 ? 'Gratuito' : `${course.costCachet} cachet`}
            </span>
            <Badge variant="outline" size="sm">+100 XP</Badge>
          </div>

          {/* Barra progresso se in corso */}
          {status.kind === 'active' && (
            <ActiveProgress course={course} status={status} />
          )}

          {/* Pulsanti azione */}
          <CourseActions
            status={status}
            onStart={onStart}
            onComplete={onComplete}
          />
        </div>
      </div>
    </Card>
  );
}

function CourseStatusBadge({ status }: { status: CourseStatus }) {
  if (status.kind === 'active') {
    return <Tag size="sm" variant="info">In corso</Tag>;
  }
  if (status.kind === 'cooldown') {
    return <Tag size="sm" variant="outline">Cooldown</Tag>;
  }
  if (status.kind === 'no_cachet') {
    return <Tag size="sm" variant="outline">Cachet insufficiente</Tag>;
  }
  return <Tag size="sm" variant="success">Disponibile</Tag>;
}

function ActiveProgress({
  course,
  status,
}: {
  course: Course;
  status: Extract<CourseStatus, { kind: 'active' }>;
}) {
  const requiredMs = import.meta.env.DEV
    ? 10 * 1000
    : course.durationMinutes * 60 * 1000;
  const elapsed = requiredMs - status.remainingMs;
  const progress = Math.min((elapsed / requiredMs) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[#b8b2b3]">
        <span>Progresso</span>
        <span>
          {status.remainingMs > 0
            ? `${formatDuration(status.remainingMs)} rimanenti`
            : 'Pronto per il completamento!'}
        </span>
      </div>
      <ProgressBar value={progress} max={100} color="gold" size="sm" />
    </div>
  );
}

function CourseActions({
  status,
  onStart,
  onComplete,
}: {
  status: CourseStatus;
  onStart: () => void;
  onComplete: () => void;
}) {
  if (status.kind === 'active') {
    const canComplete = status.remainingMs <= 0;
    return (
      <button
        type="button"
        onClick={canComplete ? onComplete : undefined}
        disabled={!canComplete}
        className={[
          'w-full rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity',
          canComplete
            ? 'bg-[#4fc87a] hover:opacity-90'
            : 'bg-[#2d2728] opacity-50 cursor-not-allowed',
        ].join(' ')}
      >
        <span className="inline-flex items-center gap-2 justify-center">
          <CheckCircle size={15} />
          {canComplete ? 'Completa corso' : `Attendi ${formatDuration(status.remainingMs)}`}
        </span>
      </button>
    );
  }

  if (status.kind === 'cooldown') {
    return (
      <p className="text-xs text-[#ff9aac]">
        Disponibile tra {formatDuration(status.remainingMs)}
      </p>
    );
  }

  if (status.kind === 'no_cachet') {
    return (
      <p className="text-xs text-[#ff9aac]">Cachet insufficiente per avviare questo corso.</p>
    );
  }

  // available
  return (
    <button
      type="button"
      onClick={onStart}
      className="w-full rounded-xl bg-[#a82847] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
    >
      <span className="inline-flex items-center gap-2 justify-center">
        <BookOpen size={15} />
        Avvia corso
      </span>
    </button>
  );
}
