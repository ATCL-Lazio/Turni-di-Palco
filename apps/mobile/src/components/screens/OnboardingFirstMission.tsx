import React, { useEffect, useState } from 'react';
import { Screen } from '../ui/Screen';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Zap, Star } from 'lucide-react';
import { FIRST_MISSIONS } from '../../data/onboarding/first_mission';
import type { RoleId } from '../../state/store';

interface OnboardingFirstMissionProps {
  roleId: RoleId;
  onComplete: (xpEarned: number) => void;
  onSkip: () => void;
}

type Phase =
  | { kind: 'choosing' }
  | { kind: 'outcome'; outcomeText: string; xpEarned: number };

const AUTO_ADVANCE_MS = 3500;

export function OnboardingFirstMission({ roleId, onComplete, onSkip }: OnboardingFirstMissionProps) {
  const mission = FIRST_MISSIONS[roleId];
  const [phase, setPhase] = useState<Phase>({ kind: 'choosing' });

  useEffect(() => {
    if (phase.kind !== 'outcome') return;
    const timer = setTimeout(() => onComplete(phase.xpEarned), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  if (!mission) {
    return (
      <Screen withBottomNavPadding={false}>
        <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
          <p className="text-[#b8b2b3]">Missione non trovata per questo ruolo.</p>
          <Button variant="primary" onClick={onSkip}>Continua</Button>
        </div>
      </Screen>
    );
  }

  if (phase.kind === 'outcome') {
    return (
      <Screen withBottomNavPadding={false}>
        <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#a82847] to-[#6b1529] flex items-center justify-center shadow-lg">
            <Star className="text-[#f4bf4f]" size={40} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#f4bf4f]">Prima missione completata</p>
            <p className="text-[#f7f3f4] text-lg leading-snug px-2">{phase.outcomeText}</p>
          </div>

          <div className="flex items-center gap-2 bg-[#1a1617] border border-[#f4bf4f]/30 rounded-xl px-5 py-3">
            <Zap className="text-[#f4bf4f]" size={20} />
            <span className="text-white font-bold text-xl">+{phase.xpEarned} XP</span>
          </div>

          <Button variant="primary" size="lg" fullWidth onClick={() => onComplete(phase.xpEarned)}>
            Vai alla Home
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavPadding={false}>
      <div className="flex flex-col h-full px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] gap-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#f4bf4f]">Prima missione</p>
            <p className="text-xs text-[#9a9697] mt-1">{mission.scene.setting}</p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-[#9a9697] text-sm underline underline-offset-2 py-1"
          >
            Salta
          </button>
        </div>

        <Card className="flex-1 flex flex-col justify-center">
          <p className="text-[#f7f3f4] text-base leading-relaxed">{mission.scene.prompt}</p>
        </Card>

        <div className="space-y-3">
          {mission.choices.map((choice, idx) => (
            <Button
              key={idx}
              variant={idx === 0 ? 'primary' : 'secondary'}
              size="lg"
              fullWidth
              onClick={() =>
                setPhase({ kind: 'outcome', outcomeText: choice.outcome, xpEarned: choice.xpReward })
              }
            >
              {choice.label}
            </Button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
