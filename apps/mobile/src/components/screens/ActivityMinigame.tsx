import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Timer, SlidersHorizontal, Target } from 'lucide-react';
import { Activity, RoleId } from '../../state/store';
import {
  computeOutcome,
  computeRoundScore,
  getMinigameConfig,
  MinigameConfig,
  MinigameOutcome,
  RoleStats,
} from '../../gameplay/minigames';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { Slider } from '../ui/slider';
import { useAccessibilityPreferences } from '../../hooks/useAccessibilityPreferences';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const triggerHaptic = (pattern: number | number[]) => {
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;
  navigator.vibrate(pattern);
};

interface ActivityMinigameProps {
  activity: Activity;
  roleId?: RoleId;
  roleStats?: RoleStats | null;
  onComplete: (outcome: MinigameOutcome) => void;
  onCancel: () => void;
}

interface MinigameShellProps {
  title: string;
  activityTitle: string;
  roundLabel: string;
  icon: React.ReactNode;
  onCancel: () => void;
  children: React.ReactNode;
}

function MinigameShell({
  title,
  activityTitle,
  roundLabel,
  icon,
  onCancel,
  children,
}: MinigameShellProps) {
  return (
    <div className="min-h-screen pb-[calc(env(safe-area-inset-bottom,_0px)+96px)]">
      <div className="app-content px-6 pt-6 space-y-6">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center size-[44px] hover:bg-[#241f20] rounded-lg transition-colors"
            aria-label="Chiudi"
          >
            <X className="text-[#f4bf4f]" size={22} />
          </button>
          <Tag size="sm" variant="info">
            {roundLabel}
          </Tag>
        </header>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h2 className="text-white">{title}</h2>
          </div>
        </div>

        <Badge variant="outline" size="sm">
          {activityTitle}
        </Badge>

        {children}
      </div>
    </div>
  );
}

interface TimingMinigameProps {
  config: MinigameConfig;
  activityTitle: string;
  onComplete: (outcome: MinigameOutcome) => void;
  onCancel: () => void;
}

function TimingMinigame({ config, activityTitle, onComplete, onCancel }: TimingMinigameProps) {
  const { accessibleMode } = useAccessibilityPreferences();
  const rounds = useMemo(
    () => (accessibleMode
      ? config.rounds.map(r => ({ ...r, tolerance: Math.round(r.tolerance * 1.6) }))
      : config.rounds),
    [config.rounds, accessibleMode],
  );
  const [phase, setPhase] = useState<'intro' | 'playing' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ label: string; delta: number } | null>(null);
  const directionRef = useRef(1);
  const animationRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const hasStoppedRef = useRef(false);
  const attemptCountRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const speed = accessibleMode ? 0.022 : 0.045;
  const feedbackHoldMs = accessibleMode ? 1800 : 900;

  const round = rounds[roundIndex];
  const roundLabel = `Round ${roundIndex + 1}/${rounds.length}`;
  const isPlaying = phase === 'playing';

  const stopAnimation = useCallback(() => {
    if (animationRef.current != null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (phase !== 'playing') {
      stopAnimation();
      return undefined;
    }

    let lastTime = performance.now();

    const animate = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      setProgress((value) => {
        let next = value + directionRef.current * delta * speed;
        if (next >= 100) {
          next = 100;
          directionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          directionRef.current = 1;
        }
        return next;
      });

      animationRef.current = window.requestAnimationFrame(animate);
    };

    animationRef.current = window.requestAnimationFrame(animate);

    return () => {
      stopAnimation();
    };
  }, [phase, roundIndex, stopAnimation]);

  useEffect(() => {
    return () => {
      stopAnimation();
      if (feedbackTimeoutRef.current != null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [stopAnimation]);

  const handleStart = () => {
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    attemptCountRef.current += 1;
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    setFeedback(null);
    setProgress(0);
    directionRef.current = 1;
    hasStoppedRef.current = false;
    setPhase('playing');
    triggerHaptic(10);
  };

  const handleStop = () => {
    if (phase !== 'playing' || hasStoppedRef.current) return;
    hasStoppedRef.current = true;

    const result = computeRoundScore(round.target, progress, round.tolerance);
    const nextScores = [...roundScores, result.score];

    setRoundScores(nextScores);
    setFeedback({ label: result.label, delta: result.delta });
    setPhase('feedback');
    triggerHaptic(result.label === 'Perfetto' ? [20, 30, 20] : 12);

    feedbackTimeoutRef.current = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((value) => value + 1);
        setPhase('playing');
        setFeedback(null);
        setProgress(0);
        directionRef.current = 1;
        hasStoppedRef.current = false;
      } else {
        setPhase('done');
        onComplete(
          computeOutcome(config.type, nextScores, {
            attempts: attemptCountRef.current,
            durationMs: Date.now() - (startedAtRef.current ?? Date.now()),
          })
        );
      }
    }, feedbackHoldMs);
  };

  return (
    <MinigameShell
      title={config.title}
      activityTitle={activityTitle}
      roundLabel={roundLabel}
      icon={<Timer className="text-[#f4bf4f]" size={24} />}
      onCancel={onCancel}
    >
      <Card
        className={`bg-gradient-to-br from-[#1a1617] to-[#241f20] ${isPlaying ? 'touch-none select-none' : ''}`}
        onPointerDown={isPlaying ? handleStop : undefined}
        role={isPlaying ? 'button' : undefined}
        aria-label={isPlaying ? 'Blocca il cue' : undefined}
        aria-disabled={!isPlaying}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-semibold">{round.label}</p>
          </div>
          <Tag size="sm" variant="outline">
            Target {round.target}%
          </Tag>
        </div>

        <div className="relative h-6 rounded-full bg-[#241f20] overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-2 bg-[#f4bf4f]/40"
            style={{ left: `${round.target}%`, transform: 'translateX(-50%)' }}
          />
          <div
            className="absolute top-0 bottom-0 w-3 bg-[#f4bf4f] rounded-full shadow-[0_0_8px_rgba(244,191,79,0.6)]"
            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-[#9a9697]">
          <span>0</span>
          <span>100</span>
        </div>

        {isPlaying ? (
          <p className="mt-3 text-xs text-center text-[#9a9697]">
            Tocca ovunque sul pannello per bloccare subito
          </p>
        ) : null}

        {feedback ? (
          <div className="mt-4 flex items-center justify-between">
            <Badge
              variant={
                feedback.label === 'Da migliorare'
                  ? 'default'
                  : feedback.label === 'Buono'
                    ? 'outline'
                    : 'success'
              }
              size="sm"
            >
              {feedback.label}
            </Badge>
            <span className="text-xs text-[#b8b2b3]">Scarto {Math.round(feedback.delta)}%</span>
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {phase === 'intro' ? (
          <Button variant="primary" size="lg" fullWidth onClick={handleStart}>
            Inizia minigioco
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="min-h-[56px]"
            onClick={handleStop}
            disabled={phase !== 'playing'}
          >
            Blocca
          </Button>
        )}

        <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
          Torna indietro
        </Button>
      </div>
    </MinigameShell>
  );
}

interface AudioMinigameProps {
  config: MinigameConfig;
  activityTitle: string;
  onComplete: (outcome: MinigameOutcome) => void;
  onCancel: () => void;
}

function AudioMinigame({ config, activityTitle, onComplete, onCancel }: AudioMinigameProps) {
  const { accessibleMode } = useAccessibilityPreferences();
  const rounds = useMemo(
    () => (accessibleMode
      ? config.rounds.map(r => ({ ...r, tolerance: Math.round(r.tolerance * 1.6) }))
      : config.rounds),
    [config.rounds, accessibleMode],
  );
  const feedbackHoldMs = accessibleMode ? 1800 : 900;
  const [phase, setPhase] = useState<'intro' | 'adjust' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [level, setLevel] = useState<number[]>([50]);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ label: string; delta: number } | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const attemptCountRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const step = 5;

  const round = rounds[roundIndex];
  const roundLabel = `Round ${roundIndex + 1}/${rounds.length}`;

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current != null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleStart = () => {
    attemptCountRef.current += 1;
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    setFeedback(null);
    setLevel([50]);
    setPhase('adjust');
    triggerHaptic(10);
  };

  const bumpLevel = (delta: number) => {
    setLevel((prev) => [clamp((prev[0] ?? 0) + delta, 0, 100)]);
    triggerHaptic(6);
  };

  const handleConfirm = () => {
    if (phase !== 'adjust') return;
    const hit = level[0] ?? 0;
    const result = computeRoundScore(round.target, hit, round.tolerance);
    const nextScores = [...roundScores, result.score];

    setRoundScores(nextScores);
    setFeedback({ label: result.label, delta: result.delta });
    setPhase('feedback');
    triggerHaptic(result.label === 'Perfetto' ? [20, 30, 20] : 12);

    feedbackTimeoutRef.current = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((value) => value + 1);
        setPhase('adjust');
        setFeedback(null);
        setLevel([50]);
      } else {
        setPhase('done');
        onComplete(
          computeOutcome(config.type, nextScores, {
            attempts: attemptCountRef.current,
            durationMs: Date.now() - (startedAtRef.current ?? Date.now()),
          })
        );
      }
    }, feedbackHoldMs);
  };

  return (
    <MinigameShell
      title={config.title}
      activityTitle={activityTitle}
      roundLabel={roundLabel}
      icon={<SlidersHorizontal className="text-[#f4bf4f]" size={22} />}
      onCancel={onCancel}
    >
      <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-semibold">{round.label}</p>
          </div>
          <Tag size="sm" variant="outline">
            Target {round.target}%
          </Tag>
        </div>

        <div className="space-y-4">
          <Slider
            value={level}
            min={0}
            max={100}
            step={1}
            onValueChange={setLevel}
            disabled={phase !== 'adjust'}
            trackClassName="bg-[#241f20] data-[orientation=horizontal]:h-5"
            rangeClassName="bg-[#f4bf4f]"
            thumbClassName="size-6 border-[#f4bf4f] bg-[#f4bf4f] shadow-[0_0_10px_rgba(244,191,79,0.6)]"
          />
          <div className="flex items-center justify-between text-xs text-[#9a9697]">
            <span>0</span>
            <span>100</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => bumpLevel(-step)}
              disabled={phase !== 'adjust'}
              className="min-w-[72px] h-[48px] rounded-xl border border-[#2d2728] text-[#f4bf4f] text-sm font-semibold disabled:opacity-50"
              aria-label={`Riduci di ${step}`}
            >
              -{step}
            </button>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-[#f4bf4f]">
                <Target size={16} />
                <span className="text-xs">Livello attuale</span>
              </div>
              <p className="text-2xl text-white mt-1">{Math.round(level[0] ?? 0)}%</p>
            </div>
            <button
              type="button"
              onClick={() => bumpLevel(step)}
              disabled={phase !== 'adjust'}
              className="min-w-[72px] h-[48px] rounded-xl border border-[#2d2728] text-[#f4bf4f] text-sm font-semibold disabled:opacity-50"
              aria-label={`Aumenta di ${step}`}
            >
              +{step}
            </button>
          </div>
        </div>

        {feedback ? (
          <div className="mt-4 flex items-center justify-between">
            <Badge
              variant={
                feedback.label === 'Da migliorare'
                  ? 'default'
                  : feedback.label === 'Buono'
                    ? 'outline'
                    : 'success'
              }
              size="sm"
            >
              {feedback.label}
            </Badge>
            <span className="text-xs text-[#b8b2b3]">Scarto {Math.round(feedback.delta)}%</span>
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {phase === 'intro' ? (
          <Button variant="primary" size="lg" fullWidth onClick={handleStart}>
            Inizia minigioco
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth onClick={handleConfirm} disabled={phase !== 'adjust'}>
            Conferma livello
          </Button>
        )}

        <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
          Torna indietro
        </Button>
      </div>
    </MinigameShell>
  );
}

export function ActivityMinigame({ activity, roleId, roleStats, onComplete, onCancel }: ActivityMinigameProps) {
  const config = useMemo(() => getMinigameConfig(activity.id, roleId, roleStats), [activity.id, roleId, roleStats]);

  if (config.type === 'audio') {
    return <AudioMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />;
  }

  return <TimingMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />;
}
