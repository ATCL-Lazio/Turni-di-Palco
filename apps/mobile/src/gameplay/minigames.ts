import type { RoleId } from '../state/store';

export type MinigameType = 'timing' | 'audio';

export type MinigameRound = {
  target: number;
  tolerance: number;
  label: string;
};

export type MinigameConfig = {
  type: MinigameType;
  title: string;
  subtitle: string;
  rounds: MinigameRound[];
  allowedRoles?: RoleId[];
  roleOverrides?: Partial<Record<RoleId, Partial<Pick<MinigameConfig, 'title' | 'subtitle' | 'rounds'>>>>;
};

export type MinigameRating = 'Perfetto' | 'Ottimo' | 'Buono' | 'Da migliorare';

export type MinigameOutcome = {
  type: MinigameType;
  score: number;
  rating: MinigameRating;
  accuracy: number;
  roundScores: number[];
  attempts: number;
  durationMs: number;
};

// TODO: supportare configurazioni minigame remote per rollout, tuning e ruoli aggiuntivi.
const MINIGAME_BY_ACTIVITY: Record<string, MinigameConfig> = {
  ritardo: {
    type: 'timing',
    title: "Cue luci d'emergenza",
    subtitle: 'Blocca il cue quando la barra raggiunge il target.',
    rounds: [
      { target: 32, tolerance: 6, label: 'Cue 1' },
      { target: 68, tolerance: 6, label: 'Cue 2' },
      { target: 50, tolerance: 5, label: 'Cue 3' },
    ],
  },
  palco: {
    type: 'timing',
    title: 'Cambio scena rapido',
    subtitle: 'Sincronizza il cambio con i tempi di palco.',
    rounds: [
      { target: 40, tolerance: 7, label: 'Cambio 1' },
      { target: 60, tolerance: 6, label: 'Cambio 2' },
      { target: 25, tolerance: 8, label: 'Cambio 3' },
    ],
  },
  audio: {
    type: 'audio',
    title: 'Bilanciamento audio',
    subtitle: 'Allinea il livello al target indicato.',
    rounds: [
      { target: 24, tolerance: 7, label: 'Canale voce' },
      { target: 62, tolerance: 6, label: 'Microfono principale' },
      { target: 48, tolerance: 7, label: 'Ambiente' },
    ],
  },
  recitazione: {
    type: 'timing',
    title: 'Attacco battuta',
    subtitle: 'Trova il momento giusto per entrare in scena.',
    rounds: [
      { target: 55, tolerance: 6, label: 'Entrata 1' },
      { target: 20, tolerance: 8, label: 'Entrata 2' },
      { target: 75, tolerance: 6, label: 'Entrata 3' },
    ],
    roleOverrides: {
      dramaturg: {
        title: 'Analisi sottotesto',
        subtitle: 'Blocca il momento in cui la tensione della scena cambia davvero.',
      },
    },
  },
  copione: {
    type: 'timing',
    title: 'Revisione copione',
    subtitle: 'Segna i passaggi critici quando il testo entra nel punto di svolta.',
    allowedRoles: ['dramaturg'],
    rounds: [
      { target: 28, tolerance: 6, label: 'Snodo 1' },
      { target: 63, tolerance: 5, label: 'Snodo 2' },
      { target: 47, tolerance: 6, label: 'Snodo 3' },
    ],
  },
};

const FALLBACK_CONFIG: MinigameConfig = {
  type: 'timing',
  title: 'Sfida di precisione',
  subtitle: 'Blocca il cue quando la barra raggiunge il target.',
  rounds: [
    { target: 50, tolerance: 6, label: 'Round 1' },
    { target: 35, tolerance: 7, label: 'Round 2' },
    { target: 70, tolerance: 6, label: 'Round 3' },
  ],
};

/**
 * Check whether a minigame is available for the given role.
 *
 * When `roleId` is `null` or `undefined` (e.g. the user has not selected a
 * role yet), the function returns `true` only if the minigame has no
 * role restrictions (`allowedRoles` is empty or missing). If the minigame
 * is restricted to specific roles and no role is provided, it returns `false`.
 */
export function isMinigameAvailableForRole(activityId: string, roleId?: RoleId | null): boolean {
  const config = MINIGAME_BY_ACTIVITY[activityId] ?? FALLBACK_CONFIG;
  if (!config.allowedRoles?.length) return true;
  return roleId ? config.allowedRoles.includes(roleId) : false;
}

export function getMinigameConfig(activityId: string, roleId?: RoleId | null): MinigameConfig {
  const config = MINIGAME_BY_ACTIVITY[activityId] ?? FALLBACK_CONFIG;
  if (!roleId) return config;

  const override = config.roleOverrides?.[roleId];
  if (!override) return config;

  return {
    ...config,
    ...override,
    rounds: override.rounds ?? config.rounds,
  };
}

export function computeRoundScore(target: number, hit: number, tolerance: number) {
  const delta = Math.abs(target - hit);
  const score = Math.round(Math.max(0, 100 - delta * 2));
  let label = 'Da migliorare';

  if (delta <= tolerance) label = 'Perfetto';
  else if (delta <= tolerance * 2) label = 'Ottimo';
  else if (delta <= tolerance * 3) label = 'Buono';

  return { score, delta, label };
}

export function computeOutcome(
  type: MinigameType,
  roundScores: number[],
  meta?: { attempts?: number; durationMs?: number }
): MinigameOutcome {
  const safeScores = roundScores.length ? roundScores : [0];
  const total = safeScores.reduce((sum, value) => sum + value, 0);
  const score = Math.round(total / safeScores.length);
  const rating = ratingFromScore(score);

  return {
    type,
    score,
    accuracy: score,
    rating,
    roundScores,
    attempts: Math.max(1, Math.round(meta?.attempts ?? 1)),
    durationMs: Math.max(0, Math.round(meta?.durationMs ?? 0)),
  };
}

export function ratingFromScore(score: number): MinigameRating {
  if (score >= 90) return 'Perfetto';
  if (score >= 75) return 'Ottimo';
  if (score >= 60) return 'Buono';
  return 'Da migliorare';
}
