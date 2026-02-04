import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { X, Timer, SlidersHorizontal, Target, Hand, LayoutGrid, ListOrdered, ArrowUp, ArrowDown } from 'lucide-react';
import { Activity } from '../../state/store';
import {
  computeOutcome,
  computeRoundScore,
  getMinigameConfig,
  MinigameConfig,
  MinigameOutcome,
  MinigameRound,
} from '../../gameplay/minigames';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { Slider } from '../ui/slider';
import { ErrorBoundary } from '../ui/ErrorBoundary';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const triggerHaptic = (pattern: number | number[]) => {
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;
  navigator.vibrate(pattern);
};

interface ActivityMinigameProps {
  activity: Activity;
  onComplete: (outcome: MinigameOutcome) => void;
  onCancel: () => void;
}

interface MinigameShellProps {
  title: string;
  subtitle: string;
  activityTitle: string;
  roundLabel: string;
  icon: React.ReactNode;
  onCancel: () => void;
  children: React.ReactNode;
}

function MinigameShell({
  title,
  subtitle,
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
            <p className="text-sm text-[#b8b2b3]">{subtitle}</p>
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

interface BaseMiniProps {
  config: MinigameConfig;
  activityTitle: string;
  onComplete: (outcome: MinigameOutcome) => void;
  onCancel: () => void;
}

function TimingMinigame({ config, activityTitle, onComplete, onCancel }: BaseMiniProps) {
  const rounds = config.rounds;
  const [phase, setPhase] = useState<'intro' | 'playing' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ label: string; delta: number } | null>(null);
  const directionRef = useRef(1);
  const animationRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const hasStoppedRef = useRef(false);
  const speed = 0.045;

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
      return;
    }

    let lastTime = performance.now();
    let animationId: number;

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

      animationId = window.requestAnimationFrame(animate);
    };

    animationId = window.requestAnimationFrame(animate);
    animationRef.current = animationId;

    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [phase, roundIndex]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
    };
  }, []);

  const handleStart = () => {
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
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
      feedbackTimeoutRef.current = null;
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((value) => value + 1);
        setPhase('playing');
        setFeedback(null);
        setProgress(0);
        directionRef.current = 1;
        hasStoppedRef.current = false;
      } else {
        setPhase('done');
        onComplete(computeOutcome(config.type, nextScores));
      }
    }, 900);
  };

  return (
    <MinigameShell
      title={config.title}
      subtitle={config.subtitle}
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
            <p className="text-xs text-[#7a7577]">Blocca il cursore sul target</p>
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

        <div className="flex items-center justify-between mt-2 text-xs text-[#7a7577]">
          <span>0</span>
          <span>100</span>
        </div>

        {isPlaying ? (
          <p className="mt-3 text-xs text-center text-[#7a7577]">
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

      {phase === 'intro' ? (
        <Card className="border border-[#f4bf4f]/20">
          <p className="text-sm text-[#b8b2b3]">
            Segui il cursore e premi "Blocca" (o tocca il pannello) quando raggiunge il target.
          </p>
        </Card>
      ) : null}

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
function AudioMinigame({ config, activityTitle, onComplete, onCancel }: BaseMiniProps) {
  const rounds = config.rounds;
  const [phase, setPhase] = useState<'intro' | 'adjust' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [level, setLevel] = useState<number[]>([50]);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ label: string; delta: number } | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
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
        onComplete(computeOutcome(config.type, nextScores));
      }
    }, 900);
  };

  return (
    <MinigameShell
      title={config.title}
      subtitle={config.subtitle}
      activityTitle={activityTitle}
      roundLabel={roundLabel}
      icon={<SlidersHorizontal className="text-[#f4bf4f]" size={22} />}
      onCancel={onCancel}
    >
      <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-semibold">{round.label}</p>
            <p className="text-xs text-[#7a7577]">Regola il livello richiesto</p>
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
          <div className="flex items-center justify-between text-xs text-[#7a7577]">
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

      {phase === 'intro' ? (
        <Card className="border border-[#f4bf4f]/20">
          <p className="text-sm text-[#b8b2b3]">
            Usa lo slider o i pulsanti +/- per allineare il livello al target indicato.
          </p>
        </Card>
      ) : null}

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

const MEMORY_PADS = [
  { id: 0, label: 'A' },
  { id: 1, label: 'B' },
  { id: 2, label: 'C' },
  { id: 3, label: 'D' },
];

function MemoryMinigame({ config, activityTitle, onComplete, onCancel }: BaseMiniProps) {
  const rounds = config.rounds;
  const [phase, setPhase] = useState<'intro' | 'showing' | 'input' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [highlightedPad, setHighlightedPad] = useState<number | null>(null);
  const [input, setInput] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ label: string; accuracy: number } | null>(null);
  const sequenceTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const round = rounds[roundIndex];
  const roundLabel = `Round ${roundIndex + 1}/${rounds.length}`;
  const pattern = round.pattern ?? [0, 1, 2];

  useEffect(() => {
    if (phase !== 'showing') return;

    let index = 0;
    setInput([]);

    sequenceTimerRef.current = window.setInterval(() => {
      const pad = pattern[index];
      setHighlightedPad(pad);
      triggerHaptic(8);
      index += 1;
      if (index >= pattern.length) {
        if (sequenceTimerRef.current != null) {
          window.clearInterval(sequenceTimerRef.current);
          sequenceTimerRef.current = null;
        }
        window.setTimeout(() => {
          setHighlightedPad(null);
          setPhase('input');
        }, 320);
      }
    }, 650);

    return () => {
      if (sequenceTimerRef.current != null) {
        window.clearInterval(sequenceTimerRef.current);
        sequenceTimerRef.current = null;
      }
    };
  }, [pattern, phase]);

  useEffect(() => {
    return () => {
      if (sequenceTimerRef.current != null) {
        window.clearInterval(sequenceTimerRef.current);
      }
      if (feedbackTimerRef.current != null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const evaluateInput = useCallback((nextInput: number[]) => {
    let matches = 0;
    for (let i = 0; i < pattern.length; i += 1) {
      if (nextInput[i] === pattern[i]) matches += 1;
    }
    const accuracy = pattern.length ? Math.round((matches / pattern.length) * 100) : 0;
    const result = computeRoundScore(100, accuracy, round.tolerance);
    const nextScores = [...roundScores, result.score];
    setRoundScores(nextScores);
    setFeedback({ label: result.label, accuracy });
    setPhase('feedback');

    feedbackTimerRef.current = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((value) => value + 1);
        setPhase('showing');
      } else {
        setPhase('done');
        onComplete(computeOutcome(config.type, nextScores));
      }
    }, 900);
  }, [config.type, onComplete, pattern, round.tolerance, roundIndex, roundScores, rounds.length]);

  const handlePadClick = (pad: number) => {
    if (phase !== 'input') return;
    triggerHaptic(6);
    setInput((prev) => {
      const nextInput = [...prev, pad];
      if (nextInput.length >= pattern.length) {
        evaluateInput(nextInput);
      }
      return nextInput;
    });
  };

  return (
    <MinigameShell
      title={config.title}
      subtitle={config.subtitle}
      activityTitle={activityTitle}
      roundLabel={roundLabel}
      icon={<LayoutGrid className="text-[#f4bf4f]" size={22} />}
      onCancel={onCancel}
    >
      <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">{round.label}</p>
          <Tag size="sm" variant="outline">
            {pattern.length} step
          </Tag>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MEMORY_PADS.map((pad) => (
            <button
              key={pad.id}
              type="button"
              disabled={phase !== 'input'}
              onClick={() => handlePadClick(pad.id)}
              className={`h-16 rounded-xl border text-lg font-semibold transition-colors ${
                highlightedPad === pad.id
                  ? 'border-[#f4bf4f] bg-[#f4bf4f]/20 text-[#f4bf4f]'
                  : 'border-[#2d2728] bg-[#241f20] text-white'
              } disabled:opacity-60`}
            >
              {pad.label}
            </button>
          ))}
        </div>

        <div className="mt-4 text-xs text-[#7a7577]">
          {phase === 'showing' ? 'Memorizza la sequenza mostrata.' : null}
          {phase === 'input' ? `Sequenza inserita: ${input.length}/${pattern.length}` : null}
        </div>

        {feedback ? (
          <div className="mt-4 flex items-center justify-between">
            <Badge variant={feedback.label === 'Da migliorare' ? 'default' : 'success'} size="sm">
              {feedback.label}
            </Badge>
            <span className="text-xs text-[#b8b2b3]">Accuratezza {feedback.accuracy}%</span>
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {phase === 'intro' ? (
          <Button variant="primary" size="lg" fullWidth onClick={() => setPhase('showing')}>
            Inizia minigioco
          </Button>
        ) : phase === 'showing' ? (
          <Button variant="primary" size="lg" fullWidth disabled>
            Memorizza...
          </Button>
        ) : phase === 'input' ? (
          <Button variant="primary" size="lg" fullWidth disabled>
            Tocca la sequenza
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth disabled>
            Valutazione...
          </Button>
        )}

        <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
          Torna indietro
        </Button>
      </div>
    </MinigameShell>
  );
}

const ZONES = [
  { id: 'left', label: 'Sinistra', value: 15 },
  { id: 'center', label: 'Centro', value: 50 },
  { id: 'right', label: 'Destra', value: 85 },
];

function PlacementMinigame({ config, activityTitle, onComplete, onCancel }: BaseMiniProps) {
  const rounds = config.rounds;
  const [phase, setPhase] = useState<'intro' | 'playing' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ label: string; delta: number } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const round = rounds[roundIndex];
  const roundLabel = `Round ${roundIndex + 1}/${rounds.length}`;

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current != null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const selectZone = (value: number) => {
    if (phase !== 'playing') return;
    const result = computeRoundScore(round.target, value, round.tolerance);
    const nextScores = [...roundScores, result.score];
    setRoundScores(nextScores);
    setFeedback({ label: result.label, delta: result.delta });
    setPhase('feedback');

    feedbackTimerRef.current = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((current) => current + 1);
        setPhase('playing');
        setFeedback(null);
      } else {
        setPhase('done');
        onComplete(computeOutcome(config.type, nextScores));
      }
    }, 900);
  };

  return (
    <MinigameShell
      title={config.title}
      subtitle={config.subtitle}
      activityTitle={activityTitle}
      roundLabel={roundLabel}
      icon={<LayoutGrid className="text-[#f4bf4f]" size={22} />}
      onCancel={onCancel}
    >
      <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">{round.label}</p>
          <Tag size="sm" variant="outline">
            Target zona
          </Tag>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              type="button"
              disabled={phase !== 'playing'}
              onClick={() => selectZone(zone.value)}
              className="h-20 rounded-xl border border-[#2d2728] bg-[#241f20] text-white disabled:opacity-50"
            >
              {zone.label}
            </button>
          ))}
        </div>

        {feedback ? (
          <div className="mt-4 flex items-center justify-between">
            <Badge variant={feedback.label === 'Da migliorare' ? 'default' : 'success'} size="sm">
              {feedback.label}
            </Badge>
            <span className="text-xs text-[#b8b2b3]">Scarto {Math.round(feedback.delta)}%</span>
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {phase === 'intro' ? (
          <Button variant="primary" size="lg" fullWidth onClick={() => setPhase('playing')}>
            Inizia minigioco
          </Button>
        ) : phase === 'playing' ? (
          <Button variant="primary" size="lg" fullWidth disabled>
            Seleziona una zona
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth disabled>
            Valutazione...
          </Button>
        )}

        <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
          Torna indietro
        </Button>
      </div>
    </MinigameShell>
  );
}

function RapidMinigame({ config, activityTitle, onComplete, onCancel }: BaseMiniProps) {
  const rounds = config.rounds;
  const [phase, setPhase] = useState<'intro' | 'playing' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [feedback, setFeedback] = useState<{ label: string; delta: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const round = rounds[roundIndex];
  const roundLabel = `Round ${roundIndex + 1}/${rounds.length}`;
  const durationMs = round.durationMs ?? 4000;

  const clearTimers = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  const evaluateRound = useCallback(() => {
    const result = computeRoundScore(round.target, tapCount, round.tolerance);
    const nextScores = [...roundScores, result.score];
    setRoundScores(nextScores);
    setFeedback({ label: result.label, delta: result.delta });
    setPhase('feedback');

    const timeoutId = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((value) => value + 1);
        setTapCount(0);
        setFeedback(null);
        setPhase('playing');
      } else {
        setPhase('done');
        onComplete(computeOutcome(config.type, nextScores));
      }
    }, 900);
    return timeoutId;
  }, [config.type, onComplete, round.target, round.tolerance, roundIndex, roundScores, rounds.length, tapCount]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const start = Date.now();
    setTimeLeftMs(durationMs);
    clearTimers();

    tickRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, durationMs - elapsed);
      setTimeLeftMs(remaining);
    }, 100);

    timerRef.current = window.setTimeout(() => {
      clearTimers();
      evaluateRound();
    }, durationMs);

    return clearTimers;
  }, [durationMs, evaluateRound, phase, roundIndex]);

  const handleTap = () => {
    if (phase !== 'playing') return;
    setTapCount((value) => value + 1);
    triggerHaptic(4);
  };

  return (
    <MinigameShell
      title={config.title}
      subtitle={config.subtitle}
      activityTitle={activityTitle}
      roundLabel={roundLabel}
      icon={<Hand className="text-[#f4bf4f]" size={22} />}
      onCancel={onCancel}
    >
      <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20] text-center">
        <p className="text-white font-semibold mb-1">{round.label}</p>
        <p className="text-xs text-[#7a7577] mb-4">Target tap: {round.target}</p>

        <button
          type="button"
          onClick={handleTap}
          disabled={phase !== 'playing'}
          className="w-full h-36 rounded-2xl border border-[#2d2728] bg-[#241f20] text-white text-2xl font-bold disabled:opacity-50"
        >
          TAP x{tapCount}
        </button>

        <div className="mt-4 flex items-center justify-between text-sm text-[#b8b2b3]">
          <span>Tempo</span>
          <span>{Math.max(0, (timeLeftMs / 1000)).toFixed(1)}s</span>
        </div>

        {feedback ? (
          <div className="mt-4 flex items-center justify-between">
            <Badge variant={feedback.label === 'Da migliorare' ? 'default' : 'success'} size="sm">
              {feedback.label}
            </Badge>
            <span className="text-xs text-[#b8b2b3]">Scarto {Math.round(feedback.delta)}</span>
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {phase === 'intro' ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              setTapCount(0);
              setFeedback(null);
              setPhase('playing');
            }}
          >
            Inizia minigioco
          </Button>
        ) : phase === 'playing' ? (
          <Button variant="primary" size="lg" fullWidth disabled>
            Tocca il pulsante centrale
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth disabled>
            Valutazione...
          </Button>
        )}

        <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
          Torna indietro
        </Button>
      </div>
    </MinigameShell>
  );
}

function computePriorityAccuracy(round: MinigameRound, order: number[]) {
  const expected = round.expectedOrder ?? order;
  if (!expected.length) return 0;
  let matches = 0;
  for (let i = 0; i < expected.length; i += 1) {
    if (order[i] === expected[i]) matches += 1;
  }
  return Math.round((matches / expected.length) * 100);
}

function PriorityMinigame({ config, activityTitle, onComplete, onCancel }: BaseMiniProps) {
  const rounds = config.rounds;
  const [phase, setPhase] = useState<'intro' | 'sorting' | 'feedback' | 'done'>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ label: string; accuracy: number } | null>(null);
  const feedbackRef = useRef<number | null>(null);

  const round = rounds[roundIndex];
  const roundLabel = `Round ${roundIndex + 1}/${rounds.length}`;
  const choices = round.choices ?? ['Cue 1', 'Cue 2', 'Cue 3'];

  useEffect(() => {
    setOrder(choices.map((_, index) => index));
  }, [roundIndex]);

  useEffect(() => {
    return () => {
      if (feedbackRef.current != null) window.clearTimeout(feedbackRef.current);
    };
  }, []);

  const moveItem = (index: number, direction: -1 | 1) => {
    setOrder((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [current] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, current);
      return copy;
    });
  };

  const confirmOrder = () => {
    if (phase !== 'sorting') return;
    const accuracy = computePriorityAccuracy(round, order);
    const result = computeRoundScore(100, accuracy, round.tolerance);
    const nextScores = [...roundScores, result.score];
    setRoundScores(nextScores);
    setFeedback({ label: result.label, accuracy });
    setPhase('feedback');

    feedbackRef.current = window.setTimeout(() => {
      if (roundIndex + 1 < rounds.length) {
        setRoundIndex((value) => value + 1);
        setFeedback(null);
        setPhase('sorting');
      } else {
        setPhase('done');
        onComplete(computeOutcome(config.type, nextScores));
      }
    }, 900);
  };

  return (
    <MinigameShell
      title={config.title}
      subtitle={config.subtitle}
      activityTitle={activityTitle}
      roundLabel={roundLabel}
      icon={<ListOrdered className="text-[#f4bf4f]" size={22} />}
      onCancel={onCancel}
    >
      <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
        <p className="text-white font-semibold mb-3">{round.label}</p>
        <div className="space-y-2">
          {order.map((choiceIndex, index) => (
            <div key={`${round.label}-${choiceIndex}`} className="flex items-center gap-2 border border-[#2d2728] rounded-xl p-2 bg-[#241f20]">
              <span className="text-[#f4bf4f] w-5 text-center">{index + 1}</span>
              <span className="flex-1 text-white text-sm">{choices[choiceIndex]}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="size-8 rounded-lg border border-[#3a3435] text-[#f4bf4f] disabled:opacity-40"
                  disabled={phase !== 'sorting' || index === 0}
                  onClick={() => moveItem(index, -1)}
                >
                  <ArrowUp size={14} className="mx-auto" />
                </button>
                <button
                  type="button"
                  className="size-8 rounded-lg border border-[#3a3435] text-[#f4bf4f] disabled:opacity-40"
                  disabled={phase !== 'sorting' || index === order.length - 1}
                  onClick={() => moveItem(index, 1)}
                >
                  <ArrowDown size={14} className="mx-auto" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {feedback ? (
          <div className="mt-4 flex items-center justify-between">
            <Badge variant={feedback.label === 'Da migliorare' ? 'default' : 'success'} size="sm">
              {feedback.label}
            </Badge>
            <span className="text-xs text-[#b8b2b3]">Accuratezza {feedback.accuracy}%</span>
          </div>
        ) : null}
      </Card>

      <div className="space-y-3">
        {phase === 'intro' ? (
          <Button variant="primary" size="lg" fullWidth onClick={() => setPhase('sorting')}>
            Inizia minigioco
          </Button>
        ) : phase === 'sorting' ? (
          <Button variant="primary" size="lg" fullWidth onClick={confirmOrder}>
            Conferma ordine
          </Button>
        ) : (
          <Button variant="primary" size="lg" fullWidth disabled>
            Valutazione...
          </Button>
        )}

        <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
          Torna indietro
        </Button>
      </div>
    </MinigameShell>
  );
}

export function ActivityMinigame({ activity, onComplete, onCancel }: ActivityMinigameProps) {
  const config = useMemo(() => getMinigameConfig(activity.id), [activity.id]);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Minigame error:', error, errorInfo);
      }}
    >
      {config.type === 'audio' && (
        <AudioMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />
      )}
      {config.type === 'memory' && (
        <MemoryMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />
      )}
      {config.type === 'placement' && (
        <PlacementMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />
      )}
      {config.type === 'rapid' && (
        <RapidMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />
      )}
      {config.type === 'priority' && (
        <PriorityMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />
      )}
      {config.type === 'timing' && (
        <TimingMinigame config={config} activityTitle={activity.title} onComplete={onComplete} onCancel={onCancel} />
      )}
    </ErrorBoundary>
  );
}
