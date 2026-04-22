import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string | null;
}

const STEPS: TutorialStep[] = [
  { id: 'welcome', title: 'Ciao {nome}!', description: 'Due passi veloci per orientarti in Turni di Palco.', targetSelector: null },
  { id: 'stats', title: 'Progressi e ricompense', description: 'Livello, reputazione ATCL, Cachet e Token: tutto quello che guadagni lavorando è qui.', targetSelector: '[data-tutorial="stats"]' },
  { id: 'navigation', title: "Tutto il resto", description: 'Dalla barra in basso raggiungi turni, classifica, negozio e profilo. Buon lavoro!', targetSelector: '[data-tutorial="bottom-nav"]' },
];

interface WelcomeTutorialProps {
  userName: string;
  onComplete: () => void;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function SpotlightHighlight({ rect, reducedMotion }: { rect: DOMRect; reducedMotion: boolean }) {
  return (
    <div
      className={`absolute border-2 border-[#f4bf4f] rounded-xl ${reducedMotion ? '' : 'animate-tutorial-spotlight-pulse'}`}
      style={{
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        borderRadius: 12,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
        pointerEvents: 'none',
      }}
    />
  );
}

function StepCard({
  step,
  userName,
  position,
  reducedMotion,
}: {
  step: TutorialStep;
  userName: string;
  position: { top?: number; bottom?: number; left: number; right: number; arrowDirection: 'up' | 'down'; spotlightCenterX: number } | null;
  reducedMotion: boolean;
}) {
  const title = step.title.replace('{nome}', userName);
  const description = step.description.replace('{nome}', userName);

  const positionStyle: React.CSSProperties = position
    ? {
        position: 'absolute',
        ...(position.top !== undefined ? { top: position.top } : {}),
        ...(position.bottom !== undefined ? { bottom: position.bottom } : {}),
        left: position.left,
        right: position.right,
      }
    : {
        position: 'absolute',
        top: '50%',
        left: 16,
        right: 16,
        transform: 'translateY(-50%)',
      };

  // Calculate arrow horizontal position relative to the card
  const arrowLeft = position
    ? Math.min(Math.max(position.spotlightCenterX - position.left - 10, 12), window.innerWidth - position.left - position.right - 32 - 12)
    : 0;

  return (
    <div
      className={`relative rounded-2xl border border-[#3a2f30] bg-[#1a1617] p-5 shadow-[0px_16px_40px_rgba(0,0,0,0.45)] ${reducedMotion ? '' : (position ? 'animate-tutorial-tooltip-in' : 'animate-tutorial-fade-in')}`}
      style={positionStyle}
    >
      {position && position.arrowDirection === 'up' && (
        <div
          className="tutorial-arrow-up"
          style={{ position: 'absolute', top: -10, left: arrowLeft }}
        />
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#c9b8b9]">{description}</p>
      {position && position.arrowDirection === 'down' && (
        <div
          className="tutorial-arrow-down"
          style={{ position: 'absolute', bottom: -10, left: arrowLeft }}
        />
      )}
    </div>
  );
}

function BottomControls({
  step,
  total,
  onNext,
  onSkip,
  isLast,
  isFirst,
  nextButtonRef,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
  isFirst: boolean;
  nextButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-4 px-6 pb-[calc(env(safe-area-inset-bottom,_0px)+24px)]">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${i === step ? 'bg-[#f4bf4f]' : 'bg-[#3a2f30]'}`}
          />
        ))}
      </div>
      <button
        ref={nextButtonRef}
        type="button"
        onClick={onNext}
        className="h-[44px] w-full max-w-[320px] rounded-[16px] bg-gradient-to-b from-[#a82847] to-[#6b1529] text-[16px] font-semibold text-white"
      >
        {isFirst ? 'Inizia' : isLast ? 'Inizia a esplorare' : 'Avanti'}
      </button>
      {!isLast && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[#8a7a7b] underline"
        >
          Salta tutorial
        </button>
      )}
    </div>
  );
}

export function WelcomeTutorial({ userName, onComplete }: WelcomeTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();

  const currentStep = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (!currentStep.targetSelector) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      setSpotlightRect(el.getBoundingClientRect());
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep.targetSelector]);

  useEffect(() => {
    nextButtonRef.current?.focus();
  }, [stepIndex]);

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLast, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const tooltipPosition = (() => {
    if (!spotlightRect) return null;
    // Clearance per dots + pulsanti + safe-area (~220px)
    const BOTTOM_CONTROLS_MIN = 220;
    const isBottomHalf = spotlightRect.top + spotlightRect.height / 2 > window.innerHeight / 2;
    const spotlightCenterX = spotlightRect.left + spotlightRect.width / 2;
    if (isBottomHalf) {
      return {
        bottom: Math.max(window.innerHeight - spotlightRect.top + 24, BOTTOM_CONTROLS_MIN),
        left: 16,
        right: 16,
        arrowDirection: 'down' as const,
        spotlightCenterX,
      };
    }
    return {
      top: spotlightRect.bottom + 24,
      left: 16,
      right: 16,
      arrowDirection: 'up' as const,
      spotlightCenterX,
    };
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial di benvenuto"
      className={`fixed inset-0 z-[999] ${reducedMotion ? '' : 'animate-tutorial-fade-in'}`}
    >
      {spotlightRect ? (
        <SpotlightHighlight rect={spotlightRect} reducedMotion={reducedMotion} />
      ) : (
        <div className="absolute inset-0 bg-black/75" />
      )}

      <StepCard
        key={currentStep.id}
        step={currentStep}
        userName={userName}
        position={tooltipPosition}
        reducedMotion={reducedMotion}
      />

      <BottomControls
        step={stepIndex}
        total={STEPS.length}
        onNext={handleNext}
        onSkip={handleSkip}
        isLast={isLast}
        isFirst={isFirst}
        nextButtonRef={nextButtonRef}
      />
    </div>
  );
}
