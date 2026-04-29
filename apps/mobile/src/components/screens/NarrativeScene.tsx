import React, { useMemo, useState } from 'react';
import { Screen } from '../ui/Screen';
import {
  applyChoice,
  createRunState,
  evaluateChoice,
  loadScene,
  type NarrativeChoice,
  type NarrativeContext,
  type NarrativeOutcome,
  type NarrativeRunState,
  type NarrativeScene as NarrativeSceneData,
} from '../../gameplay/narrative';
import type { CompleteNarrativeChoiceInput, RoleId, Rewards } from '../../state/store';
import type { RoleStats } from '../../gameplay/minigames';

// Eagerly initialize the scene registry on module load.
import '../../data/narrative';

interface NarrativeSceneProps {
  sceneId: string;
  roleId: RoleId | null;
  roleStats: RoleStats | null;
  onSubmit: (input: CompleteNarrativeChoiceInput) => Promise<{ ok: boolean; rewards?: Rewards; error?: string }>;
  onClose: () => void;
}

type LocalState =
  | { phase: 'choosing'; run: NarrativeRunState }
  | { phase: 'submitting'; run: NarrativeRunState; choiceId: string }
  | { phase: 'outcome'; run: NarrativeRunState; outcome: NarrativeOutcome; rewards: Rewards }
  | { phase: 'error'; message: string };

function rewardsLine(rewards: Rewards): string {
  const parts: string[] = [];
  if (rewards.xp) parts.push(`+${rewards.xp} XP`);
  if (rewards.cachet) parts.push(`+${rewards.cachet} cachet`);
  if (rewards.reputation) parts.push(`+${rewards.reputation} reputazione`);
  return parts.join(' · ') || 'Nessuna ricompensa';
}

export function NarrativeScene({ sceneId, roleId, roleStats, onSubmit, onClose }: NarrativeSceneProps) {
  const scene = useMemo<NarrativeSceneData | null>(() => loadScene(sceneId), [sceneId]);

  const ctx: NarrativeContext = useMemo(
    () => ({ roleId, stats: roleStats, flags: new Set<string>() }),
    [roleId, roleStats],
  );

  const [local, setLocal] = useState<LocalState>(() =>
    scene
      ? { phase: 'choosing', run: createRunState(scene.id) }
      : { phase: 'error', message: `Scenario "${sceneId}" non trovato.` },
  );

  if (!scene || local.phase === 'error') {
    return (
      <Screen withBottomNavPadding={false}>
        <h1 className="text-xl font-semibold">Scenario non disponibile</h1>
        <p className="text-sm text-[#9a9697]">
          {local.phase === 'error' ? local.message : 'Lo scenario richiesto non è registrato.'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 self-start rounded-xl bg-[#a82847] px-4 py-2 text-sm font-medium text-white"
        >
          Torna indietro
        </button>
      </Screen>
    );
  }

  if (local.phase === 'outcome') {
    return (
      <Screen withBottomNavPadding={false}>
        <span className="text-xs uppercase tracking-wider text-[#a82847]">Esito</span>
        <h1 className="text-xl font-semibold">{scene.title}</h1>
        <p className="text-base leading-relaxed text-[#e3e0e0]">{local.outcome.text}</p>
        <p className="text-sm font-medium text-[#d4af37]">{rewardsLine(local.rewards)}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[#a82847] px-4 py-3 text-sm font-medium text-white"
        >
          Continua
        </button>
      </Screen>
    );
  }

  const submitting = local.phase === 'submitting';
  const submittingChoiceId = submitting ? local.choiceId : null;

  const handleChoose = async (choice: NarrativeChoice) => {
    if (submitting) return;
    const availability = evaluateChoice(choice, ctx);
    if (!availability.available) return;

    setLocal({ phase: 'submitting', run: local.run, choiceId: choice.id });

    let nextRun: NarrativeRunState;
    let outcome: NarrativeOutcome;
    try {
      const result = applyChoice(local.run, scene, choice.id, ctx);
      nextRun = result.state;
      outcome = result.outcome;
    } catch (error) {
      setLocal({ phase: 'error', message: error instanceof Error ? error.message : 'Errore sconosciuto' });
      return;
    }

    const submitResult = await onSubmit({
      sceneId: scene.id,
      choiceId: choice.id,
      rewards: outcome.rewards,
      setFlags: outcome.setFlags,
    });

    if (!submitResult.ok) {
      setLocal({ phase: 'error', message: submitResult.error ?? 'Errore nel salvataggio della scelta' });
      return;
    }

    setLocal({
      phase: 'outcome',
      run: nextRun,
      outcome,
      rewards: submitResult.rewards ?? { xp: 0, cachet: 0, reputation: 0 },
    });
  };

  return (
    <Screen withBottomNavPadding={false}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[#9a9697]">{scene.setting}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#9a9697] underline"
          aria-label="Chiudi scenario"
        >
          Esci
        </button>
      </div>
      <h1 className="text-xl font-semibold">{scene.title}</h1>
      <p className="text-base leading-relaxed text-[#e3e0e0]">{scene.prompt}</p>

      <div className="mt-4 flex flex-col gap-2">
        {scene.choices.map(choice => {
          const availability = evaluateChoice(choice, ctx);
          const disabled = !availability.available || submitting;
          const isSubmittingThis = submittingChoiceId === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => handleChoose(choice)}
              disabled={disabled}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                disabled
                  ? 'border-[#2d2728] bg-[#1a1617] text-[#6f6a6b]'
                  : 'border-[#a82847] bg-[#1a1617] text-white hover:bg-[#2d1820]'
              }`}
            >
              <span className="block font-medium">{choice.label}</span>
              {!availability.available && availability.reason === 'stat' && availability.detail && (
                <span className="mt-1 block text-xs text-[#a82847]">{availability.detail}</span>
              )}
              {isSubmittingThis && <span className="mt-1 block text-xs text-[#9a9697]">In corso…</span>}
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
