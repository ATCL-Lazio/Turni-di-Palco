import React, { useCallback, useEffect, useState } from 'react';
import { Screen } from '../ui/Screen';
import {
  applyChoice,
  createRunState,
  evaluateChoice,
  fetchScene,
  isDailySceneCompleted,
  isSceneAvailable,
  loadScene,
  markDailySceneCompleted,
  MAXWELL_ID_PREFIX,
  type NarrativeChoice,
  type NarrativeContext,
  type NarrativeOutcome,
  type NarrativeRunState,
  type NarrativeScene as NarrativeSceneData,
} from '../../gameplay/narrative';
import type { CompleteNarrativeChoiceInput, RoleId, Rewards } from '../../state/store';
import type { RoleStats } from '../../gameplay/minigames';

// Eagerly initialize the scene registry on module load (generic scenes only;
// theater scenes are loaded lazily via `ensureTheaterScenesLoaded`).
import { ensureTheaterScenesLoaded } from '../../data/narrative';

const THEATER_ID_PREFIX = 'theater_';

interface NarrativeSceneProps {
  sceneId: string;
  roleId: RoleId | null;
  roleStats: RoleStats | null;
  onSubmit: (input: CompleteNarrativeChoiceInput) => Promise<{ ok: boolean; rewards?: Rewards; error?: string }>;
  onClose: () => void;
}

type LocalState =
  | { phase: 'loading' }
  | { phase: 'daily_done' }
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

function resolveInitialState(sceneId: string, roleId: RoleId | null, roleStats: RoleStats | null): LocalState {
  // Dynamic scenes: check if today's daily challenge was already completed
  if (sceneId.startsWith(MAXWELL_ID_PREFIX)) {
    const ctx = makeCtx(roleId, roleStats, new Set());
    if (isDailySceneCompleted(ctx)) return { phase: 'daily_done' };
    return { phase: 'loading' };
  }

  // Theater scenes live in a lazy chunk (#478). Show the loading state and
  // let the effect await `ensureTheaterScenesLoaded()` before lookup.
  if (sceneId.startsWith(THEATER_ID_PREFIX)) {
    return { phase: 'loading' };
  }

  // Static scene — resolve synchronously from the registry
  const scene = loadScene(sceneId);
  if (!scene) return { phase: 'error', message: `Scenario "${sceneId}" non trovato.` };
  const ctx = makeCtx(roleId, roleStats, new Set());
  if (!isSceneAvailable(scene, ctx)) {
    return { phase: 'error', message: 'Accesso allo scenario non consentito per il tuo ruolo o le tue attività.' };
  }
  return { phase: 'choosing', run: createRunState(scene.id), scene };
}

export function NarrativeScene({ sceneId, roleId, roleStats, onSubmit, onClose }: NarrativeSceneProps) {
  const [local, setLocal] = useState<LocalState>(() =>
    resolveInitialState(sceneId, roleId, roleStats)
  );

  // Re-run resolveInitialState whenever sceneId or roleId change so that
  // navigating between scenes or switching roles shows fresh state rather
  // than the stale value captured by the lazy useState initializer (which
  // only runs on the initial mount).
  const prevSceneIdRef = React.useRef(sceneId);
  const prevRoleIdRef = React.useRef(roleId);
  const prevRoleStatsRef = React.useRef(roleStats);
  useEffect(() => {
    const prevStats = prevRoleStatsRef.current;
    const statsChanged = roleStats !== prevStats && (
      !roleStats || !prevStats ||
      roleStats.presence !== prevStats.presence ||
      roleStats.precision !== prevStats.precision ||
      roleStats.leadership !== prevStats.leadership ||
      roleStats.creativity !== prevStats.creativity
    );
    if (sceneId !== prevSceneIdRef.current || roleId !== prevRoleIdRef.current || statsChanged) {
      prevSceneIdRef.current = sceneId;
      prevRoleIdRef.current = roleId;
      prevRoleStatsRef.current = roleStats;
      setLocal(resolveInitialState(sceneId, roleId, roleStats));
    }
  }, [sceneId, roleId, roleStats]);

  const startLoad = useCallback(() => {
    setLocal({ phase: 'loading' });
  }, []);

  // Async load for theater scenes (lazy chunk) and Maxwell-generated scenes
  useEffect(() => {
    if (local.phase !== 'loading') return;

    const ctx = makeCtx(roleId, roleStats, new Set());
    const controller = new AbortController();

    // Theater scenes: wait for the lazy chunk, then resolve from the
    // already-populated registry. No Maxwell call needed.
    if (sceneId.startsWith(THEATER_ID_PREFIX)) {
      ensureTheaterScenesLoaded().then(() => {
        if (controller.signal.aborted) return;
        const scene = loadScene(sceneId);
        if (!scene) {
          setLocal({ phase: 'error', message: `Scenario "${sceneId}" non trovato.` });
          return;
        }
        if (!isSceneAvailable(scene, ctx)) {
          setLocal({ phase: 'error', message: 'Accesso allo scenario non consentito per il tuo ruolo o le tue attività.' });
          return;
        }
        setLocal({ phase: 'choosing', run: createRunState(scene.id), scene });
      }).catch(() => {
        if (controller.signal.aborted) return;
        setLocal({ phase: 'error', message: `Scenario "${sceneId}" non disponibile al momento.` });
      });
      return () => controller.abort();
    }

    fetchScene(sceneId, ctx, { signal: controller.signal }).then(scene => {
      if (controller.signal.aborted) return;

      if (!scene) {
        setLocal({ phase: 'error', message: 'Maxwell non è disponibile. Riprova tra qualche secondo.' });
        return;
      }

      if (!isSceneAvailable(scene, ctx)) {
        setLocal({ phase: 'error', message: 'Accesso allo scenario non consentito per il tuo ruolo o le tue attività.' });
        return;
      }
      setLocal({ phase: 'choosing', run: createRunState(scene.id), scene });
    }).catch(() => {
      if (controller.signal.aborted) return;
      setLocal({ phase: 'error', message: 'Maxwell non è disponibile. Riprova tra qualche secondo.' });
    });

    return () => controller.abort();
  }, [local.phase, sceneId, roleId, roleStats]);

  if (local.phase === 'loading') {
    return (
      <Screen withBottomNavPadding={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="size-8 animate-spin rounded-full border-2 border-[#a82847] border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-[#9a9697]">Maxwell sta preparando uno scenario…</p>
        </div>
      </Screen>
    );
  }

  if (local.phase === 'daily_done') {
    return (
      <Screen withBottomNavPadding={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-xl font-semibold text-[#f5f0f1]">Sfida completata!</h1>
          <p className="text-sm text-[#9a9697]">Hai già completato lo scenario di oggi.<br />Torna domani per la prossima sfida.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-xl bg-[#a82847] px-6 py-2 text-sm font-medium text-white"
          >
            Torna alle attività
          </button>
        </div>
      </Screen>
    );
  }

  if (local.phase === 'error') {
    const canRetry = sceneId.startsWith(MAXWELL_ID_PREFIX);
    return (
      <Screen withBottomNavPadding={false}>
        <h1 className="text-xl font-semibold">Scenario non disponibile</h1>
        <p className="text-sm text-[#9a9697]">{local.message}</p>
        <div className="mt-4 flex gap-3">
          {canRetry && (
            <button
              type="button"
              onClick={startLoad}
              className="rounded-xl bg-[#a82847] px-4 py-2 text-sm font-medium text-white"
            >
              Riprova
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#4a3f41] px-4 py-2 text-sm font-medium text-[#b8b2b3]"
          >
            Torna indietro
          </button>
        </div>
      </Screen>
    );
  }

  if (local.phase === 'outcome') {
    const handleContinue = async () => {
      if (local.finished) { onClose(); return; }
      const nextSceneId = local.run.currentSceneId;
      // Theater scenes live in a lazy chunk and require the registry to be
      // populated before `loadScene` can find them (issue #1283).
      if (nextSceneId.startsWith(THEATER_ID_PREFIX)) {
        try {
          await ensureTheaterScenesLoaded();
        } catch {
          setLocal({ phase: 'error', message: `Scenario "${nextSceneId}" non disponibile al momento.` });
          return;
        }
      }
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

    let submitResult: { ok: boolean; rewards?: Rewards; error?: string };
    try {
      submitResult = await onSubmit({
        sceneId: activeScene.id,
        choiceId: choice.id,
        rewards: outcome.rewards,
        setFlags: outcome.setFlags,
      });
    } catch (error) {
      setLocal({ phase: 'error', message: error instanceof Error ? error.message : 'Errore nel salvataggio della scelta' });
      return;
    }

    if (!submitResult.ok) {
      setLocal({ phase: 'error', message: submitResult.error ?? 'Errore nel salvataggio della scelta' });
      return;
    }

    if (finished && sceneId.startsWith(MAXWELL_ID_PREFIX)) {
      markDailySceneCompleted(makeCtx(roleId, roleStats, new Set()));
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
