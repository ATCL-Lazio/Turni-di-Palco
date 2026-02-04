import type { ActivityMinigameType } from '../state/store';

export type MinigameType = ActivityMinigameType;

export type MinigameRound = {
  target: number;
  tolerance: number;
  label: string;
  pattern?: number[];
  choices?: string[];
  expectedOrder?: number[];
  durationMs?: number;
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
  luci_cue: {
    type: 'timing',
    title: 'Tempismo cue luci',
    subtitle: 'Esegui i cue senza anticipare o ritardare la regia.',
    rounds: [
      { target: 28, tolerance: 6, label: 'Cue blu' },
      { target: 47, tolerance: 5, label: 'Cue rosso' },
      { target: 81, tolerance: 7, label: 'Cue finale' },
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
  monitor_mix: {
    type: 'audio',
    title: 'Mix monitor di palco',
    subtitle: 'Bilancia monitor side, center e in-ear.',
    rounds: [
      { target: 35, tolerance: 6, label: 'Monitor center' },
      { target: 58, tolerance: 7, label: 'Monitor side' },
      { target: 44, tolerance: 6, label: 'In-ear cast' },
    ],
  },
  microfoni_wireless: {
    type: 'audio',
    title: 'Setup microfoni wireless',
    subtitle: 'Imposta livelli stabili sui canali in rotazione.',
    rounds: [
      { target: 30, tolerance: 5, label: 'Canale A' },
      { target: 66, tolerance: 6, label: 'Canale B' },
      { target: 52, tolerance: 6, label: 'Canale C' },
    ],
  },
  line_check: {
    type: 'audio',
    title: 'Line check finale',
    subtitle: 'Regola i livelli senza saturare il mix finale.',
    rounds: [
      { target: 22, tolerance: 7, label: 'VOX' },
      { target: 74, tolerance: 8, label: 'Band' },
      { target: 46, tolerance: 6, label: 'FX return' },
    ],
  },
  memory_blocking: {
    type: 'memory',
    title: 'Memoria blocking scena',
    subtitle: 'Memorizza e ripeti la sequenza visualizzata.',
    rounds: [
      { target: 100, tolerance: 8, label: 'Sequenza 1', pattern: [0, 2, 1] },
      { target: 100, tolerance: 8, label: 'Sequenza 2', pattern: [3, 0, 2, 1] },
      { target: 100, tolerance: 8, label: 'Sequenza 3', pattern: [1, 3, 2, 0, 2] },
    ],
  },
  prop_placement: {
    type: 'placement',
    title: 'Posizionamento props',
    subtitle: 'Posiziona ogni prop nella zona corretta del palco.',
    rounds: [
      { target: 15, tolerance: 18, label: 'Prop 1' },
      { target: 50, tolerance: 18, label: 'Prop 2' },
      { target: 85, tolerance: 18, label: 'Prop 3' },
    ],
  },
  rapid_reset: {
    type: 'rapid',
    title: 'Sprint reset palco',
    subtitle: 'Tocca rapidamente per raggiungere il target entro il tempo.',
    rounds: [
      { target: 28, tolerance: 6, label: 'Sprint 1', durationMs: 4000 },
      { target: 36, tolerance: 7, label: 'Sprint 2', durationMs: 4000 },
      { target: 44, tolerance: 8, label: 'Sprint 3', durationMs: 4500 },
    ],
  },
  cue_priority: {
    type: 'priority',
    title: 'Priorita cue regia',
    subtitle: 'Riordina i cue in base all urgenza operativa.',
    rounds: [
      {
        target: 100,
        tolerance: 8,
        label: 'Scenario A',
        choices: ['Luci scena', 'Entrata cast', 'Audio intro'],
        expectedOrder: [1, 2, 0],
      },
      {
        target: 100,
        tolerance: 8,
        label: 'Scenario B',
        choices: ['Cambio props', 'Cue fumo', 'Microfono lead'],
        expectedOrder: [2, 0, 1],
      },
      {
        target: 100,
        tolerance: 8,
        label: 'Scenario C',
        choices: ['Apertura sipario', 'Check monitor', 'Segnale regia'],
        expectedOrder: [2, 1, 0],
      },
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
