import type { TurnRecord, TurnStats, TheatreReputation, Badge } from './types';

export function computeTurnStatsFromTurns(turns: TurnRecord[]): TurnStats {
  const totalTurns = turns.length;
  if (!turns.length) {
    return { totalTurns: 0, turnsThisMonth: 0, uniqueTheatres: 0 };
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const turnsThisMonth = turns.filter((turn) => {
    const created = new Date(turn.createdAt);
    return created.getFullYear() === year && created.getMonth() === month;
  }).length;
  const uniqueTheatres = new Set(turns.map((turn) => turn.theatre).filter(Boolean)).size;
  return { totalTurns, turnsThisMonth, uniqueTheatres };
}

export function computeTheatreReputationFromTurns(turns: TurnRecord[]): TheatreReputation[] {
  const map = new Map<string, { reputation: number; totalTurns: number }>();

  turns.forEach((turn) => {
    const theatre = turn.theatre?.trim();
    if (!theatre) return;
    const previous = map.get(theatre) ?? { reputation: 0, totalTurns: 0 };
    map.set(theatre, {
      reputation: Math.min(100, previous.reputation + (turn.rewards?.reputation ?? 0)),
      totalTurns: previous.totalTurns + 1,
    });
  });

  return [...map.entries()]
    .map(([theatre, entry]) => ({
      theatre,
      reputation: entry.reputation,
      totalTurns: entry.totalTurns,
    }))
    .sort(
      (a, b) =>
        b.reputation - a.reputation ||
        b.totalTurns - a.totalTurns ||
        a.theatre.localeCompare(b.theatre)
    );
}

const FALLBACK_BADGES: Array<Omit<Badge, 'unlocked' | 'unlockedAt' | 'seenAt'>> = [
  {
    id: 'first_turn',
    title: 'Primo sipario',
    description: 'Registra il tuo primo turno ATCL.',
    icon: 'Award',
    metric: 'total_turns',
    threshold: 1,
    isHidden: false,
  },
  {
    id: 'turns_this_month_3',
    title: 'Ritmo di scena',
    description: 'Completa 3 turni nello stesso mese.',
    icon: 'Calendar',
    metric: 'turns_this_month',
    threshold: 3,
    isHidden: false,
  },
  {
    id: 'unique_theatres_3',
    title: 'Teatri in tour',
    description: 'Lavora in 3 teatri diversi.',
    icon: 'MapPin',
    metric: 'unique_theatres',
    threshold: 3,
    isHidden: false,
  },
  {
    id: 'total_turns_10',
    title: 'Presenza costante',
    description: 'Raggiungi 10 turni registrati.',
    icon: 'Theater',
    metric: 'total_turns',
    threshold: 10,
    isHidden: false,
  },
  {
    id: 'turns_this_month_6',
    title: 'Settimana piena',
    description: 'Completa 6 turni nello stesso mese.',
    icon: 'Calendar',
    metric: 'turns_this_month',
    threshold: 6,
    isHidden: true,
  },
  {
    id: 'unique_theatres_5',
    title: 'Compagnia itinerante',
    description: 'Lavora in 5 teatri diversi.',
    icon: 'MapPin',
    metric: 'unique_theatres',
    threshold: 5,
    isHidden: false,
  },
  {
    id: 'total_turns_25',
    title: 'Veterano di palco',
    description: 'Raggiungi 25 turni registrati.',
    icon: 'Award',
    metric: 'total_turns',
    threshold: 25,
    isHidden: true,
  },
  {
    id: 'unique_theatres_8',
    title: 'Mappa completa',
    description: 'Lavora in 8 teatri diversi.',
    icon: 'MapPin',
    metric: 'unique_theatres',
    threshold: 8,
    isHidden: true,
  },
];

export function computeFallbackBadges(stats: TurnStats): Badge[] {
  return FALLBACK_BADGES.map((badge) => {
    const unlocked =
      badge.metric === 'total_turns' && badge.threshold != null
        ? stats.totalTurns >= badge.threshold
        : badge.metric === 'turns_this_month' && badge.threshold != null
          ? stats.turnsThisMonth >= badge.threshold
          : badge.metric === 'unique_theatres' && badge.threshold != null
            ? stats.uniqueTheatres >= badge.threshold
            : false;
    return { ...badge, unlocked, unlockedAt: null, seenAt: null };
  });
}
