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
};

export type MinigameRating = 'Perfetto' | 'Ottimo' | 'Buono' | 'Da migliorare';

export type MinigameOutcome = {
  type: MinigameType;
  score: number;
  rating: MinigameRating;
  accuracy: number;
  roundScores: number[];
};

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

export function getMinigameConfig(activityId: string): MinigameConfig {
  return MINIGAME_BY_ACTIVITY[activityId] ?? FALLBACK_CONFIG;
}

export function computeRoundScore(target: number, hit: number, tolerance: number) {
  const delta = Math.abs(target - hit);
  const accuracy = Math.max(0, 100 - delta * 2);
  const score = Math.round(accuracy);
  let label = 'Da migliorare';

  if (delta <= tolerance) label = 'Perfetto';
  else if (delta <= tolerance * 2) label = 'Ottimo';
  else if (delta <= tolerance * 3) label = 'Buono';

  return { score, accuracy, delta, label };
}

export function computeOutcome(type: MinigameType, roundScores: number[]): MinigameOutcome {
  const safeScores = roundScores.length ? roundScores : [0];
  const total = safeScores.reduce((sum, value) => sum + value, 0);
  const score = Math.round(total / safeScores.length);
  const accuracy = Math.round(score);
  const rating = ratingFromScore(score);

  return {
    type,
    score,
    accuracy,
    rating,
    roundScores: roundScores,
  };
}

export function ratingFromScore(score: number): MinigameRating {
  if (score >= 90) return 'Perfetto';
  if (score >= 75) return 'Ottimo';
  if (score >= 60) return 'Buono';
  return 'Da migliorare';
}
