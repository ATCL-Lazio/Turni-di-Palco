import React, { useState } from 'react';
import { Screen } from '../ui/Screen';
import {
  applyChoice,
  createRunState,
  evaluateChoice,
  isSceneAvailable,
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
  | { phase: 'choosing'; run: NarrativeRunState; scene: NarrativeSceneData }
  | { phase: 'submitting'; run: NarrativeRunState; scene: NarrativeSceneData; choiceId: string }
  | { phase: 'outcome'; run: NarrativeRunState; scene: NarrativeSceneData; outcome: NarrativeOutcome; rewards: Rewards; finished: boolean }
  | { phase: 'error'; message: string };

function rewardsLine(rewards: Rewards): string {
  const parts: string[] = [];
  if (rewards.xp) parts.push(`+${rewards.xp} XP`);
  if (rewards.cachet) parts.push(`+${rewards.cachet} cachet`);
  if (rewards.reputation) parts.push(`+${rewards.reputation} reputazione`);
  return parts.join(' · ') || 'Nessuna ricompensa';
}

function makeCtx(roleId: RoleId | null, roleStats: RoleStats | null, flags: ReadonlySet<string>): NarrativeContext {
  return { roleId, stats: roleStats, flags };
}

export function NarrativeScene({ sceneId, roleId, roleStats, onSubmit, onClose }: NarrativeSceneProps) {
  const [local, setLocal] = useState<LocalState>(() => {
    const scene = loadScene(sceneId);
    if (!scene) return { phase: 'error', message: `Scenario "${sceneId}" non trovato.` };
    const ctx = makeCtx(roleId, roleStats, new Set());
    if (!isSceneAvailable(scene, ctx)) {
      return { phase: 'error', message: 'Accesso allo scenario non consentito per il tuo ruolo o le tue attività.' };
    }
    return { phase: 'choosing', run: createRunState(scene.id), scene };
  });

  if (local.phase === 'error') {
    return (
      <Screen withBottomNavPadding={false}>
        <h1 className="text-xl font-semibold">Scenario non disponibile</h1>
        <p className="text-sm text-[#9a9697]">{local.message}</p>
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
    const handleContinue = () => {
      if (local.finished) { onClose(); return; }
      const nextSceneId = local.run.currentSceneId;
      const nextScene = loadScene(nextSceneId);
      if (!nextScene) {
        setLocal({ phase: 'error', message: `Scenario "${nextSceneId}" non trovato.` });
        return;
      }
      const nextCtx = makeCtx(roleId, roleStats, local.run.flags);
      if (!isSceneAvailable(nextScene, nextCtx)) {
        setLocal({ phase: 'error', message: 'Accesso allo scenario successivo non consentito.' });
        return;
      }
      setLocal({ phase: 'choosing', run: local.run, scene: nextScene });
    };

    return (
      <Screen withBottomNavPadding={false}>
        <span className="text-xs uppercase tracking-wider text-[#a82847]">Esito</span>
        <h1 className="text-xl font-semibold">{local.scene.title}</h1>
        <p className="text-base leading-relaxed text-[#e3e0e0]">{local.outcome.text}</p>
        <p className="text-sm font-medium text-[#d4af37]">{rewardsLine(local.rewards)}</p>
        <button
          type="button"
          onClick={handleContinue}
          className="mt-6 w-full rounded-xl bg-[#a82847] px-4 py-3 text-sm font-medium text-white"
        >
          {local.finished ? 'Continua' : 'Avanti →'}
        </button>
      </Screen>
    );
  }

  // 'choosing' or 'submitting' phase
  const { run, scene: activeScene } = local;
  const submitting = local.phase === 'submitting';
  const submittingChoiceId = submitting ? local.choiceId : null;
  // Context reflects current run flags so intra-session flag gating works.
  const ctx = makeCtx(roleId, roleStats, run.flags);

  const handleChoose = async (choice: NarrativeChoice) => {
    if (submitting) return;
    if (!evaluateChoice(choice, ctx).available) return;

    setLocal({ phase: 'submitting', run, scene: activeScene, choiceId: choice.id });

    let nextRun: NarrativeRunState;
    let outcome: NarrativeOutcome;
    let finished: boolean;
    try {
      const result = applyChoice(run, activeScene, choice.id, ctx);
      nextRun = result.state;
      outcome = result.outcome;
      finished = result.finished;
    } catch (error) {
      setLocal({ phase: 'error', message: error instanceof Error ? error.message : 'Errore sconosciuto' });
      return;
    }

    const submitResult = await onSubmit({
      sceneId: activeScene.id,
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
      scene: activeScene,
      outcome,
      rewards: submitResult.rewards ?? { xp: 0, cachet: 0, reputation: 0 },
      finished,
    });
  };

  return (
    <Screen withBottomNavPadding={false}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[#9a9697]">{activeScene.setting}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#9a9697] underline"
          aria-label="Chiudi scenario"
        >
          Esci
        </button>
      </div>
      <h1 className="text-xl font-semibold">{activeScene.title}</h1>
      <p className="text-base leading-relaxed text-[#e3e0e0]">{activeScene.prompt}</p>

      <div className="mt-4 flex flex-col gap-2">
        {activeScene.choices.map(choice => {
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
