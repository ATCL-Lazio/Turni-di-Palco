import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SUPABASE_SESSION_ID_KEY, SUPABASE_SESSION_KEY } from '../lib/auth-storage';
import { resolveDisplayName } from '../lib/profile-utils';
import { formatErrorDetails, reportCriticalError } from '../services/error-handler';

export type RoleId = 'attore' | 'luci' | 'fonico' | 'attrezzista' | 'palco';

function isValidRoleId(value: string): value is RoleId {
  return ['attore', 'luci', 'fonico', 'attrezzista', 'palco'].includes(value);
}

function validateRoleId(candidate: string | null | undefined): RoleId {
  if (!candidate) return 'attore';
  return isValidRoleId(candidate) ? candidate : 'attore';
}
export type Rewards = { xp: number; reputation: number; cachet: number };

export type Role = {
  id: RoleId;
  name: string;
  focus: string;
  stats: { presence: number; precision: number; leadership: number; creativity: number };
};

export type GameEvent = {
  id: string;
  name: string;
  theatre: string;
  date: string;
  time: string;
  genre: string;
  baseRewards: Rewards;
  focusRole?: RoleId;
};

export type ActivityMinigameType =
  | 'timing'
  | 'audio'
  | 'memory'
  | 'placement'
  | 'rapid'
  | 'priority';

export type Activity = {
  id: string;
  title: string;
  description: string;
  duration: string;
  xpReward: number;
  cachetReward: number;
  reputationReward: number;
  minigameType: ActivityMinigameType;
  cooldownSeconds: number;
  maxRunsPerSession: number;
  difficulty: 'Facile' | 'Medio' | 'Difficile';
};

export type ActivityProgress = {
  runsCountSession: number;
  sessionStartedAt?: number;
  lastPlayedAt?: number;
  bestScore?: number;
  lastScore?: number;
};

export type ActivityAvailability = {
  canPlay: boolean;
  reason: 'cooldown' | 'session_limit' | null;
  remainingSeconds: number;
  runsUsed: number;
  runsRemaining: number;
  maxRunsPerSession: number;
  cooldownSeconds: number;
};

export type ActivityCompletionResult =
  | { ok: true; activity: Activity; rewards: Rewards; availability: ActivityAvailability }
  | { ok: false; reason: 'missing_activity' | 'cooldown' | 'session_limit'; availability?: ActivityAvailability };

export type TurnRecord = {
  id: string;
  eventId: string;
  eventName: string;
  theatre: string;
  date: string;
  time: string;
  roleId: RoleId;
  rewards: Rewards;
  createdAt: number;
};

export type PlayerProfile = {
  name: string;
  email: string;
  roleId: RoleId;
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpTotal: number;
  xpField: number;
  reputation: number;
  cachet: number;
  profileImage?: string;
  lastActivityAt: number;
};

export type GameState = {
  profile: PlayerProfile;
  turns: TurnRecord[];
  activityProgress: Record<string, ActivityProgress>;
};

export type TurnStats = {
  totalTurns: number;
  turnsThisMonth: number;
  uniqueTheatres: number;
};

export type TheatreReputation = {
  theatre: string;
  reputation: number;
  totalTurns: number;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  roleId: RoleId;
  xpTotal: number;
  cachet: number;
  reputation: number;
  turnsCount: number;
  profileImage?: string;
  lastActivityAt?: number;
};

export type BadgeMetric = 'total_turns' | 'turns_this_month' | 'unique_theatres' | 'manual';

export type Badge = {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  metric: BadgeMetric | null;
  threshold: number | null;
  unlocked: boolean;
  unlockedAt: number | null;
  seenAt: number | null;
};

type CatalogState = {
  roles: Role[];
  events: GameEvent[];
  activities: Activity[];
};

type FollowedEventRow = {
  event_id: string;
  events?: any;
};

export const roles: Role[] = [
  { id: 'attore', name: 'Attore / Attrice', focus: 'Presenza scenica', stats: { presence: 90, precision: 70, leadership: 60, creativity: 85 } },
  { id: 'luci', name: 'Tecnico Luci', focus: 'Precisione cue', stats: { presence: 50, precision: 95, leadership: 65, creativity: 75 } },
  { id: 'fonico', name: 'Fonico', focus: 'Pulizia audio', stats: { presence: 45, precision: 90, leadership: 60, creativity: 70 } },
  { id: 'attrezzista', name: 'Attrezzista / Scenografo', focus: 'Allestimento rapido', stats: { presence: 55, precision: 85, leadership: 70, creativity: 90 } },
  { id: 'palco', name: 'Assistente di Palco', focus: 'Coordinamento', stats: { presence: 60, precision: 88, leadership: 85, creativity: 65 } },
];

export const events: GameEvent[] = [
  {
    id: 'ATCL-001',
    name: 'Prova aperta - Teatro di Latina',
    theatre: 'Teatro di Latina',
    date: '15 Dic 2025',
    time: '20:30',
    genre: 'Drama',
    baseRewards: { xp: 150, reputation: 25, cachet: 100 },
    focusRole: 'attrezzista',
  },
  {
    id: 'ATCL-002',
    name: 'Festival Giovani Voci',
    theatre: "Teatro dell'Unione",
    date: '10 Gen 2026',
    time: '21:00',
    genre: 'Musical',
    baseRewards: { xp: 160, reputation: 30, cachet: 120 },
    focusRole: 'fonico',
  },
  {
    id: 'ATCL-003',
    name: 'Prima nazionale - Circuito ATCL',
    theatre: 'Teatro Palladium',
    date: '02 Feb 2026',
    time: '20:45',
    genre: 'Opera',
    baseRewards: { xp: 180, reputation: 35, cachet: 140 },
    focusRole: 'luci',
  },
];

export const activities: Activity[] = [
  {
    id: 'ritardo',
    title: 'Prova generale in ritardo',
    description: 'La compagnia e in ritardo di 20 minuti. Devi gestire il clima e chiudere la prova.',
    duration: '5 min',
    xpReward: 50,
    cachetReward: 20,
    reputationReward: 6,
    minigameType: 'timing',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Medio',
  },
  {
    id: 'audio',
    title: 'Prova audio critica',
    description: "Un rientro micro crea Larsen. Il tempo stringe prima dell'apertura porte.",
    duration: '6 min',
    xpReward: 60,
    cachetReward: 25,
    reputationReward: 7,
    minigameType: 'audio',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Difficile',
  },
  {
    id: 'palco',
    title: 'Cambio scena rapido',
    description: 'Il cambio scena tra due atti e piu lento del previsto. Serve velocizzare.',
    duration: '4 min',
    xpReward: 55,
    cachetReward: 22,
    reputationReward: 6,
    minigameType: 'timing',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Medio',
  },
  {
    id: 'recitazione',
    title: 'Prova di recitazione',
    description: 'Esercita le tue abilita di interpretazione con un monologo classico.',
    duration: '5 min',
    xpReward: 45,
    cachetReward: 18,
    reputationReward: 5,
    minigameType: 'timing',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Facile',
  },
  {
    id: 'luci_cue',
    title: 'Tempismo cue luci',
    description: "Allinea le chiamate luci al ritmo scena senza perdere il tempo d'ingresso.",
    duration: '4 min',
    xpReward: 52,
    cachetReward: 21,
    reputationReward: 6,
    minigameType: 'timing',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Medio',
  },
  {
    id: 'monitor_mix',
    title: 'Mix monitor di palco',
    description: 'Bilancia i monitor per cast e musicisti in una situazione ad alta pressione.',
    duration: '5 min',
    xpReward: 58,
    cachetReward: 24,
    reputationReward: 7,
    minigameType: 'audio',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Medio',
  },
  {
    id: 'microfoni_wireless',
    title: 'Setup microfoni wireless',
    description: 'Sincronizza canali e livelli evitando interferenze durante il pre-show.',
    duration: '6 min',
    xpReward: 62,
    cachetReward: 26,
    reputationReward: 8,
    minigameType: 'audio',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Difficile',
  },
  {
    id: 'line_check',
    title: 'Line check finale',
    description: "Controlla il segnale di ogni linea audio poco prima dell'apertura sala.",
    duration: '4 min',
    xpReward: 48,
    cachetReward: 19,
    reputationReward: 5,
    minigameType: 'audio',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Facile',
  },
  {
    id: 'memory_blocking',
    title: 'Memoria blocking scena',
    description: 'Ricostruisci la sequenza di movimenti del cast in ordine corretto.',
    duration: '5 min',
    xpReward: 57,
    cachetReward: 22,
    reputationReward: 6,
    minigameType: 'memory',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Medio',
  },
  {
    id: 'prop_placement',
    title: 'Posizionamento props',
    description: 'Posiziona gli oggetti di scena nelle aree corrette prima dell ingresso attori.',
    duration: '4 min',
    xpReward: 54,
    cachetReward: 21,
    reputationReward: 6,
    minigameType: 'placement',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Medio',
  },
  {
    id: 'rapid_reset',
    title: 'Sprint reset palco',
    description: 'Completa un reset tecnico rapido tra due scene con tempi strettissimi.',
    duration: '3 min',
    xpReward: 50,
    cachetReward: 20,
    reputationReward: 5,
    minigameType: 'rapid',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Facile',
  },
  {
    id: 'cue_priority',
    title: 'Priorita cue regia',
    description: 'Ordina correttamente i cue critici per evitare errori durante la replica.',
    duration: '5 min',
    xpReward: 64,
    cachetReward: 28,
    reputationReward: 8,
    minigameType: 'priority',
    cooldownSeconds: 60,
    maxRunsPerSession: 3,
    difficulty: 'Difficile',
  },
];

const STORAGE_KEY = 'tdp-mobile-ui-state';
const MAX_TURNS = 20;
const ACTIVITY_SESSION_WINDOW_MS = 1000 * 60 * 60 * 6;
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeUnicodeEscapes(value: string) {
  if (!value.includes('\\u')) return value;
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (match, codePoint: string) => {
    const parsed = Number.parseInt(codePoint, 16);
    if (!Number.isFinite(parsed)) return match;
    return String.fromCodePoint(parsed);
  });
}

function decodeHtmlEntities(value: string) {
  if (!value.includes('&')) return value;
  let decoded = value;
  for (let i = 0; i < 2; i += 1) {
    const next = decoded.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity[0] === '#') {
        const isHex = entity[1]?.toLowerCase() === 'x';
        const number = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (!Number.isFinite(number)) return match;
        try {
          return String.fromCodePoint(number);
        } catch {
          return match;
        }
      }
      return HTML_ENTITY_MAP[entity] ?? match;
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function normalizeText(value: string | null | undefined) {
  if (!value) return '';
  return decodeHtmlEntities(decodeUnicodeEscapes(value));
}

function notifyCriticalError(message: string, errors: unknown[]) {
  const details = formatErrorDetails(errors);
  reportCriticalError({
    message,
    details: details || undefined,
  });
}

type StoredSession = { access_token: string; refresh_token: string; user_id?: string };

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistStoredSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(SUPABASE_SESSION_KEY);
      window.localStorage.removeItem(SUPABASE_SESSION_ID_KEY);
      return;
    }
    const payload: StoredSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: session.user.id,
    };
    window.localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(payload));
    window.localStorage.setItem(SUPABASE_SESSION_ID_KEY, session.user.id);
  } catch {
    // ignore storage errors
  }
}

function createInitialState(): GameState {
  return {
    profile: {
      name: '',
      email: '',
      roleId: 'attore',
      level: 1,
      xp: 0,
      xpToNextLevel: 1000,
      xpTotal: 0,
      xpField: 0,
      reputation: 0,
      cachet: 0,
      profileImage: undefined,
      lastActivityAt: Date.now(),
    },
    turns: [],
    activityProgress: {},
  };
}

function createDemoState(): GameState {
  return {
    profile: {
      name: 'Mario',
      email: 'mario@example.com',
      roleId: 'attore',
      level: 5,
      xp: 1250,
      xpToNextLevel: 2000,
      xpTotal: 3500,
      xpField: 1800,
      reputation: 75,
      cachet: 250,
      profileImage: undefined,
      lastActivityAt: Date.now(),
    },
    turns: [
      {
        id: 'turn-001',
        eventId: events[0].id,
        eventName: events[0].name,
        theatre: events[0].theatre,
        date: events[0].date,
        time: events[0].time,
        roleId: 'attore',
        rewards: events[0].baseRewards,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
      },
    ],
    activityProgress: {},
  };
}

function createDefaultState(): GameState {
  if (isSupabaseConfigured) return createInitialState();
  return import.meta.env.DEV ? createDemoState() : createInitialState();
}

function loadState(): GameState {
  if (isSupabaseConfigured) return createInitialState();
  if (!import.meta.env.DEV) return createInitialState();
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.profile) return createDefaultState();
    const safeRole = roles.some((role) => role.id === parsed.profile.roleId) ? parsed.profile.roleId : createDefaultState().profile.roleId;
    const progressSource =
      parsed.activityProgress && typeof parsed.activityProgress === 'object'
        ? parsed.activityProgress
        : (parsed as any).activityStats && typeof (parsed as any).activityStats === 'object'
          ? (parsed as any).activityStats
          : {};
    const activityProgress = Object.entries(progressSource).reduce<Record<string, ActivityProgress>>((acc, [id, value]) => {
      const rawEntry = value as Record<string, unknown>;
      const runsCountSession = Number(rawEntry.runsCountSession ?? rawEntry.runs ?? 0);
      acc[id] = {
        runsCountSession: Number.isFinite(runsCountSession) ? Math.max(0, Math.floor(runsCountSession)) : 0,
        sessionStartedAt:
          typeof rawEntry.sessionStartedAt === 'number' && Number.isFinite(rawEntry.sessionStartedAt)
            ? rawEntry.sessionStartedAt
            : undefined,
        lastPlayedAt:
          typeof rawEntry.lastPlayedAt === 'number' && Number.isFinite(rawEntry.lastPlayedAt)
            ? rawEntry.lastPlayedAt
            : undefined,
        bestScore:
          typeof rawEntry.bestScore === 'number' && Number.isFinite(rawEntry.bestScore)
            ? Math.max(0, Math.min(100, Math.round(rawEntry.bestScore)))
            : undefined,
        lastScore:
          typeof rawEntry.lastScore === 'number' && Number.isFinite(rawEntry.lastScore)
            ? Math.max(0, Math.min(100, Math.round(rawEntry.lastScore)))
            : undefined,
      };
      return acc;
    }, {});
    return {
      profile: {
        ...createDefaultState().profile,
        ...parsed.profile,
        roleId: safeRole,
      },
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      activityProgress,
    };
  } catch {
    return createDefaultState();
  }
}

function saveState(state: GameState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function computeTurnStatsFromTurns(turns: TurnRecord[]): TurnStats {
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

function computeTheatreReputationFromTurns(turns: TurnRecord[]): TheatreReputation[] {
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
    id: 'unique_theatres_3',
    title: 'Ha lavorato in 3 teatri diversi',
    description: null,
    icon: 'MapPin',
    metric: 'unique_theatres',
    threshold: 3,
  },
  {
    id: 'first_season',
    title: 'Prima stagione completata',
    description: null,
    icon: 'Award',
    metric: 'manual',
    threshold: null,
  },
  {
    id: 'total_turns_10',
    title: '10 turni registrati',
    description: null,
    icon: 'Theater',
    metric: 'total_turns',
    threshold: 10,
  },
];

function computeFallbackBadges(stats: TurnStats): Badge[] {
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

function applyRewards(profile: PlayerProfile, rewards: Rewards, source: 'turn' | 'activity'): PlayerProfile {
  let nextXp = profile.xp + rewards.xp;
  let nextLevel = profile.level;
  let nextThreshold = profile.xpToNextLevel;

  while (nextXp >= nextThreshold) {
    nextXp -= nextThreshold;
    nextLevel += 1;
    nextThreshold = 1000 + nextLevel * 250;
  }

  return {
    ...profile,
    xp: nextXp,
    xpToNextLevel: nextThreshold,
    level: nextLevel,
    xpTotal: profile.xpTotal + rewards.xp,
    xpField: source === 'turn' ? profile.xpField + rewards.xp : profile.xpField,
    cachet: profile.cachet + rewards.cachet,
    reputation: Math.min(100, profile.reputation + rewards.reputation),
    lastActivityAt: Date.now(),
  };
}

function normalizeActivityProgress(
  value: ActivityProgress | undefined,
  now: number
): ActivityProgress {
  const runsCountSession = Number(value?.runsCountSession ?? 0);
  const sessionStartedAt =
    typeof value?.sessionStartedAt === 'number' && Number.isFinite(value.sessionStartedAt)
      ? value.sessionStartedAt
      : undefined;
  const lastPlayedAt =
    typeof value?.lastPlayedAt === 'number' && Number.isFinite(value.lastPlayedAt)
      ? value.lastPlayedAt
      : undefined;
  const bestScore =
    typeof value?.bestScore === 'number' && Number.isFinite(value.bestScore)
      ? Math.max(0, Math.min(100, Math.round(value.bestScore)))
      : undefined;
  const lastScore =
    typeof value?.lastScore === 'number' && Number.isFinite(value.lastScore)
      ? Math.max(0, Math.min(100, Math.round(value.lastScore)))
      : undefined;

  const sanitizedRuns = Number.isFinite(runsCountSession) ? Math.max(0, Math.floor(runsCountSession)) : 0;
  if (!sessionStartedAt || now - sessionStartedAt > ACTIVITY_SESSION_WINDOW_MS) {
    return {
      runsCountSession: 0,
      sessionStartedAt: undefined,
      lastPlayedAt,
      bestScore,
      lastScore,
    };
  }

  return {
    runsCountSession: sanitizedRuns,
    sessionStartedAt,
    lastPlayedAt,
    bestScore,
    lastScore,
  };
}

function getActivityAvailability(
  activity: Activity,
  progress: ActivityProgress | undefined,
  now: number
): ActivityAvailability {
  const normalized = normalizeActivityProgress(progress, now);
  const elapsed = normalized.lastPlayedAt ? now - normalized.lastPlayedAt : Number.POSITIVE_INFINITY;
  const cooldownMs = Math.max(0, activity.cooldownSeconds * 1000);
  const remainingSeconds =
    Number.isFinite(elapsed) && elapsed < cooldownMs
      ? Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000))
      : 0;
  const maxRuns = Math.max(1, activity.maxRunsPerSession);
  const runsUsed = Math.min(maxRuns, Math.max(0, normalized.runsCountSession));
  const runsRemaining = Math.max(0, maxRuns - runsUsed);

  if (remainingSeconds > 0) {
    return {
      canPlay: false,
      reason: 'cooldown',
      remainingSeconds,
      runsUsed,
      runsRemaining,
      maxRunsPerSession: maxRuns,
      cooldownSeconds: activity.cooldownSeconds,
    };
  }

  if (runsRemaining <= 0) {
    return {
      canPlay: false,
      reason: 'session_limit',
      remainingSeconds: 0,
      runsUsed,
      runsRemaining,
      maxRunsPerSession: maxRuns,
      cooldownSeconds: activity.cooldownSeconds,
    };
  }

  return {
    canPlay: true,
    reason: null,
    remainingSeconds: 0,
    runsUsed,
    runsRemaining,
    maxRunsPerSession: maxRuns,
    cooldownSeconds: activity.cooldownSeconds,
  };
}

export function computeTurnRewards(event: GameEvent, roleId: RoleId): Rewards {
  const bonus = event.focusRole === roleId ? 15 : 0;
  return {
    xp: event.baseRewards.xp + bonus,
    cachet: event.baseRewards.cachet + Math.round(bonus / 2),
    reputation: event.baseRewards.reputation + Math.round(bonus / 3),
  };
}

type GameContextValue = {
  authUserId: string | null;
  authReady: boolean;
  hasHydratedRemote: boolean;
  state: GameState;
  roles: Role[];
  events: GameEvent[];
  activities: Activity[];
  turnStats: TurnStats;
  statsLoading: boolean;
  theatreReputation: TheatreReputation[];
  theatreReputationLoading: boolean;
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  refreshLeaderboard: () => Promise<void>;
  badges: Badge[];
  badgesLoading: boolean;
  followedEvents: GameEvent[];
  followedEventsLoading: boolean;
  followEvent: (eventId: string) => Promise<void>;
  unfollowEvent: (eventId: string) => Promise<void>;
  isEventFollowed: (eventId: string) => boolean;
  markBadgesSeen: () => void;
  updateProfile: (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId' | 'profileImage'>>) => void;
  registerTurn: (eventId: string, roleId: RoleId) => TurnRecord | null;
  getActivityAvailability: (activityId: string) => ActivityAvailability;
  completeActivity: (activityId: string, score?: number) => ActivityCompletionResult;
  resetProgress: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  resetState: () => void;
};

const GameStateContext = createContext<GameContextValue | undefined>(undefined);

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => loadState());
  const [catalog, setCatalog] = useState<CatalogState>(() => ({
    roles,
    events,
    activities,
  }));
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [hasHydratedRemote, setHasHydratedRemote] = useState(false);
  const localTurnStats = useMemo(() => computeTurnStatsFromTurns(state.turns), [state.turns]);
  const localTheatreReputation = useMemo(
    () => computeTheatreReputationFromTurns(state.turns),
    [state.turns]
  );
  const [remoteTurnStats, setRemoteTurnStats] = useState<TurnStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [remoteTheatreReputation, setRemoteTheatreReputation] = useState<TheatreReputation[]>([]);
  const [theatreReputationLoading, setTheatreReputationLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [remoteBadges, setRemoteBadges] = useState<Badge[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [followedEvents, setFollowedEvents] = useState<GameEvent[]>([]);
  const [followedEventsLoading, setFollowedEventsLoading] = useState(false);
  const [remoteActivityProgress, setRemoteActivityProgress] = useState<Record<string, ActivityProgress>>({});

  const activityProgress = useMemo(() => {
    if (!isSupabaseConfigured || !authUserId) {
      return state.activityProgress;
    }
    
    const mergedProgress = { ...state.activityProgress };
    Object.entries(remoteActivityProgress).forEach(([activityId, remoteProgress]) => {
      const localProgress = state.activityProgress[activityId];
      if (!localProgress || remoteProgress.lastPlayedAt > localProgress.lastPlayedAt) {
        mergedProgress[activityId] = remoteProgress;
      }
    });
    
    return mergedProgress;
  }, [isSupabaseConfigured, authUserId, remoteActivityProgress, state.activityProgress]);

  const turnStats = useMemo(
    () => (isSupabaseConfigured && authUserId ? remoteTurnStats ?? localTurnStats : localTurnStats),
    [authUserId, localTurnStats, remoteTurnStats]
  );

  const badges = useMemo(
    () => (isSupabaseConfigured && authUserId ? remoteBadges : computeFallbackBadges(localTurnStats)),
    [authUserId, localTurnStats, remoteBadges]
  );

  const theatreReputation = useMemo(
    () =>
      isSupabaseConfigured && authUserId ? remoteTheatreReputation : localTheatreReputation,
    [authUserId, localTheatreReputation, remoteTheatreReputation]
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const message = import.meta.env.DEV
      ? 'Supabase non configurato: dati mock attivi.'
      : 'Supabase non configurato: impossibile caricare i dati.';
    notifyCriticalError(message, []);
  }, []);

  const refreshTurnStats = useCallback(async () => {
    if (!supabase || !authUserId) return;
    setStatsLoading(true);
    const { data, error } = await supabase!
      .from('my_turn_stats')
      .select('total_turns,turns_this_month,unique_theatres')
      .single();
    if (!error && data) {
      setRemoteTurnStats({
        totalTurns: Number(data.total_turns ?? 0),
        turnsThisMonth: Number(data.turns_this_month ?? 0),
        uniqueTheatres: Number(data.unique_theatres ?? 0),
      });
    }
    setStatsLoading(false);
  }, [authUserId]);

  const refreshTheatreReputation = useCallback(async () => {
    if (!supabase || !authUserId) return;
    setTheatreReputationLoading(true);
    const { data, error } = await supabase!
      .from('my_theatre_reputation')
      .select('theatre,reputation,total_turns');
    if (!error && data) {
      const nextReputation: TheatreReputation[] = data
        .map((row: any) => ({
          theatre: (row.theatre ?? '').toString(),
          reputation: Number(row.reputation ?? 0),
          totalTurns: Number(row.total_turns ?? 0),
        }))
        .filter((entry) => entry.theatre)
        .sort(
          (a, b) =>
            b.reputation - a.reputation ||
            b.totalTurns - a.totalTurns ||
            a.theatre.localeCompare(b.theatre)
        );
      setRemoteTheatreReputation(nextReputation);
    }
    setTheatreReputationLoading(false);
  }, [authUserId]);

  const refreshBadges = useCallback(async () => {
    if (!supabase || !authUserId) return;
    setBadgesLoading(true);
    await supabase!.rpc('evaluate_my_badges');
    const { data, error } = await supabase!
      .from('my_badges')
      .select('id,title,description,icon,metric,threshold,unlocked_at,seen_at,unlocked');
    if (!error && data) {
      const nextBadges: Badge[] = data.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? null,
        icon: row.icon ?? 'Award',
        metric: (row.metric as BadgeMetric | null) ?? null,
        threshold: row.threshold != null ? Number(row.threshold) : null,
        unlocked: Boolean(row.unlocked),
        unlockedAt: row.unlocked_at ? new Date(row.unlocked_at).getTime() : null,
        seenAt: row.seen_at ? new Date(row.seen_at).getTime() : null,
      }));
      setRemoteBadges(nextBadges);
    }
    setBadgesLoading(false);
  }, [authUserId]);

  const refreshActivityProgress = useCallback(async () => {
    if (!supabase || !authUserId) return;
    const { data, error } = await supabase
      .from('activity_progress')
      .select('activity_id,runs_count_session,session_started_at,last_played_at,best_score,last_score')
      .eq('user_id', authUserId);
    if (error || !data) return;
    const now = Date.now();
    const nextProgress = data.reduce<Record<string, ActivityProgress>>((acc, row: any) => {
      const entry: ActivityProgress = normalizeActivityProgress(
        {
          runsCountSession: Number(row.runs_count_session ?? 0),
          sessionStartedAt: row.session_started_at ? new Date(row.session_started_at).getTime() : undefined,
          lastPlayedAt: row.last_played_at ? new Date(row.last_played_at).getTime() : undefined,
          bestScore:
            row.best_score == null
              ? undefined
              : Math.max(0, Math.min(100, Math.round(Number(row.best_score)))),
          lastScore:
            row.last_score == null
              ? undefined
              : Math.max(0, Math.min(100, Math.round(Number(row.last_score)))),
        },
        now
      );
      acc[row.activity_id] = entry;
      return acc;
    }, {});
    setRemoteActivityProgress(nextProgress);
    setState((prev: GameState) => ({
      ...prev,
      activityProgress: nextProgress,
    }));
  }, [authUserId]);

  type LeaderboardRow = {
    id: string;
    name: string | null;
    role_id: string | null;
    xp_total: number | null;
    cachet: number | null;
    reputation: number | null;
    profile_image: string | null;
    last_activity_at: string | null;
    turns_count: number | null;
  };

  const refreshLeaderboard = useCallback(async () => {
    if (!supabase) return;
    setLeaderboardLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: 50 });
      if (error) throw error;

      const rows = (data as LeaderboardRow[]) ?? [];
      const nextLeaderboard: LeaderboardEntry[] = rows.map((row) => {
        const roleId = validateRoleId(row.role_id);
        const lastActivityAt = row.last_activity_at ? new Date(row.last_activity_at).getTime() : undefined;
        return {
          id: row.id,
          name: row.name ?? 'Player',
          roleId,
          xpTotal: row.xp_total ?? 0,
          cachet: row.cachet ?? 0,
          reputation: row.reputation ?? 0,
          turnsCount: row.turns_count ?? 0,
          profileImage: row.profile_image ?? undefined,
          lastActivityAt,
        };
      });
      setLeaderboard(nextLeaderboard);
    } catch (error) {
      console.warn('Supabase leaderboard fetch failed', error);
      notifyCriticalError('Non riusciamo a caricare la classifica dal database.', [error]);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const markBadgesSeen = useCallback(async () => {
    if (!supabase || !authUserId) return;
    try {
      await supabase.rpc('mark_my_badges_seen');
      await refreshBadges();
    } catch (error) {
      console.warn('Supabase mark badges seen failed', error);
    }
  }, [authUserId, refreshBadges]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    const restoreSession = async () => {
      const stored = readStoredSession();
      if (stored) {
        await supabase!.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        });
      }

      const { data } = await supabase!.auth.getSession();
      if (!isMounted) return;

      persistStoredSession(data.session ?? null);
      setAuthUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    };

    restoreSession();

    const { data: authListener } = supabase!.auth.onAuthStateChange((_event, session) => {
      persistStoredSession(session ?? null);
      if (!isMounted) return;
      setAuthUserId(session?.user.id ?? null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setHasHydratedRemote(false);
  }, [authUserId]);

  const refreshFollowedEvents = useCallback(
    async (catalogEvents: GameEvent[]) => {
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        setFollowedEvents(catalogEvents);
        return;
      }
      setFollowedEventsLoading(true);
      const { data, error } = await supabase
        .from('followed_events')
        .select('event_id, events:events(id,name,theatre,event_date,event_time,genre,base_rewards,focus_role)')
        .eq('user_id', authUserId);
      if (!error && data) {
        const mapped = (data as any[])
          .map((row) => {
            const eventData = Array.isArray(row.events) ? row.events[0] : row.events;
            if (!eventData) return null;
            return {
              id: eventData.id,
              name: normalizeText(eventData.name),
              theatre: normalizeText(eventData.theatre),
              date: normalizeText(eventData.event_date),
              time: normalizeText(eventData.event_time),
              genre: normalizeText(eventData.genre),
              baseRewards: {
                xp: Number(eventData.base_rewards?.xp ?? 0),
                reputation: Number(eventData.base_rewards?.reputation ?? 0),
                cachet: Number(eventData.base_rewards?.cachet ?? 0),
              },
              focusRole: eventData.focus_role ?? undefined,
            } as GameEvent;
          })
          .filter((e): e is GameEvent => !!e);
        setFollowedEvents(mapped);
      }
      setFollowedEventsLoading(false);
    },
    [authUserId]
  );

  const followEvent = useCallback(
    async (eventId: string) => {
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        setFollowedEvents((prev) => {
          if (prev.some((item) => item.id === eventId)) return prev;
          const event = catalog.events.find((item) => item.id === eventId);
          return event ? [event, ...prev] : prev;
        });
        return;
      }
      const { error } = await supabase
        .from('followed_events')
        .insert({ user_id: authUserId, event_id: eventId });
      if (!error) {
        const event = catalog.events.find((item) => item.id === eventId);
        if (event) {
          setFollowedEvents((prev) => [event, ...prev.filter((item) => item.id !== eventId)]);
        }
      }
    },
    [authUserId, catalog.events]
  );

  const unfollowEvent = useCallback(
    async (eventId: string) => {
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        setFollowedEvents((prev) => prev.filter((item) => item.id !== eventId));
        return;
      }
      const { error } = await supabase
        .from('followed_events')
        .delete()
        .eq('user_id', authUserId)
        .eq('event_id', eventId);
      if (!error) {
        setFollowedEvents((prev) => prev.filter((item) => item.id !== eventId));
      }
    },
    [authUserId]
  );

  const isEventFollowed = useCallback(
    (eventId: string) => followedEvents.some((event) => event.id === eventId),
    [followedEvents]
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      setRemoteTurnStats(null);
      setRemoteBadges([]);
      setRemoteTheatreReputation([]);
      setRemoteActivityProgress({});
      return;
    }
    refreshTurnStats();
    refreshTheatreReputation();
    refreshBadges();
    refreshActivityProgress();
    refreshLeaderboard();
  }, [authUserId, refreshActivityProgress, refreshBadges, refreshTheatreReputation, refreshTurnStats]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      setFollowedEvents(catalog.events);
      return;
    }
    refreshFollowedEvents(catalog.events);
  }, [authUserId, catalog.events, refreshFollowedEvents]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    const loadCatalog = async () => {
      const [rolesRes, eventsRes, activitiesRes] = await Promise.all([
        supabase!.from('roles').select('id,name,focus,stats'),
        supabase!
          .from('events')
          .select('id,name,theatre,event_date,event_time,genre,base_rewards,focus_role'),
        supabase!
          .from('activities')
          .select('id,title,description,duration,xp_reward,cachet_reward,reputation_reward,minigame_type,cooldown_seconds,max_runs_per_session,difficulty'),
      ]);

      if (!isMounted) return;

      const nextRoles =
        rolesRes.error || !rolesRes.data?.length
          ? roles
          : rolesRes.data.map((role: any) => ({
            id: role.id as RoleId,
            name: role.name,
            focus: role.focus,
            stats: {
              presence: Number(role.stats?.presence ?? 0),
              precision: Number(role.stats?.precision ?? 0),
              leadership: Number(role.stats?.leadership ?? 0),
              creativity: Number(role.stats?.creativity ?? 0),
            },
          }));

      const nextEvents =
        eventsRes.error || !eventsRes.data?.length
          ? (isSupabaseConfigured ? [] : import.meta.env.DEV ? events : [])
          : eventsRes.data.map((event: any) => ({
            id: event.id,
            name: normalizeText(event.name),
            theatre: normalizeText(event.theatre),
            date: normalizeText(event.event_date),
            time: normalizeText(event.event_time),
            genre: normalizeText(event.genre),
            baseRewards: {
              xp: Number(event.base_rewards?.xp ?? 0),
              reputation: Number(event.base_rewards?.reputation ?? 0),
              cachet: Number(event.base_rewards?.cachet ?? 0),
            },
            focusRole: event.focus_role ?? undefined,
          }));

      const nextActivities =
        activitiesRes.error || !activitiesRes.data?.length
          ? import.meta.env.DEV ? activities : []
          : activitiesRes.data.map((activity: any) => ({
            id: activity.id,
            title: activity.title,
            description: activity.description,
            duration: activity.duration,
            xpReward: Number(activity.xp_reward ?? 0),
            cachetReward: Number(activity.cachet_reward ?? 0),
            reputationReward: Number(activity.reputation_reward ?? 5),
            minigameType: (activity.minigame_type as ActivityMinigameType) ?? 'timing',
            cooldownSeconds: Math.max(0, Number(activity.cooldown_seconds ?? 60)),
            maxRunsPerSession: Math.max(1, Number(activity.max_runs_per_session ?? 3)),
            difficulty: activity.difficulty as Activity['difficulty'],
          }));

      setCatalog({
        roles: nextRoles,
        events: nextEvents,
        activities: nextActivities,
      });
      refreshFollowedEvents(nextEvents);
    };

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;
    let isMounted = true;

    const loadRemoteState = async () => {
      const [userRes, profileRes, turnsRes, activityProgressRes] = await Promise.all([
        supabase!.auth.getUser(),
        supabase!.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
        supabase!.from('turns').select('*').eq('user_id', authUserId).order('created_at', { ascending: false }),
        supabase!
          .from('activity_progress')
          .select('activity_id,runs_count_session,session_started_at,last_played_at,best_score,last_score')
          .eq('user_id', authUserId),
      ]);

      if (!isMounted) return;

      if (userRes.error || profileRes.error || turnsRes.error || activityProgressRes.error) {
        notifyCriticalError('Non riusciamo a caricare il profilo dal database.', [
          userRes.error,
          profileRes.error,
          turnsRes.error,
          activityProgressRes.error,
        ]);
      }

      let profileRow: any = profileRes.data;

      if (!profileRow && userRes.data?.user?.email) {
        const user = userRes.data.user;
        const displayName = resolveDisplayName({
          name: user.user_metadata?.name,
          metadata: user.user_metadata,
          email: user.email,
          fallback: 'Utente',
        });
        const insertRes = await supabase!
          .from('profiles')
          .insert({
            id: authUserId,
            name: displayName,
            email: user.email,
            role_id: 'attore',
          })
          .select('*')
          .single();
        if (insertRes.error) {
          notifyCriticalError('Non riusciamo a creare il profilo utente.', [insertRes.error]);
        }
        profileRow = insertRes.data ?? null;
      }

      if (!isMounted) return;

      const remoteTurns = Array.isArray(turnsRes.data)
        ? turnsRes.data.map((turn: any) => ({
          id: turn.id,
          eventId: turn.event_id ?? '',
          eventName: normalizeText(turn.event_name),
          theatre: normalizeText(turn.theatre),
          date: normalizeText(turn.event_date),
          time: normalizeText(turn.event_time),
          roleId: (turn.role_id as RoleId) ?? 'attore',
          rewards: {
            xp: Number(turn.rewards?.xp ?? 0),
            reputation: Number(turn.rewards?.reputation ?? 0),
            cachet: Number(turn.rewards?.cachet ?? 0),
          },
          createdAt: turn.created_at ? new Date(turn.created_at).getTime() : Date.now(),
        }))
        : [];

      const now = Date.now();
      const remoteActivityProgress = Array.isArray(activityProgressRes.data)
        ? activityProgressRes.data.reduce<Record<string, ActivityProgress>>((acc, row: any) => {
          acc[row.activity_id] = normalizeActivityProgress(
            {
              runsCountSession: Number(row.runs_count_session ?? 0),
              sessionStartedAt: row.session_started_at ? new Date(row.session_started_at).getTime() : undefined,
              lastPlayedAt: row.last_played_at ? new Date(row.last_played_at).getTime() : undefined,
              bestScore:
                row.best_score == null ? undefined : Math.max(0, Math.min(100, Math.round(Number(row.best_score)))),
              lastScore:
                row.last_score == null ? undefined : Math.max(0, Math.min(100, Math.round(Number(row.last_score)))),
            },
            now
          );
          return acc;
        }, {})
        : {};
      setRemoteActivityProgress(remoteActivityProgress);

      if (profileRow) {
        const user = userRes.data?.user;
        setState((prev: GameState) => ({
          profile: {
            ...prev.profile,
            name: resolveDisplayName({
              name: profileRow.name,
              metadata: user?.user_metadata,
              email: profileRow.email ?? user?.email ?? prev.profile.email,
              fallback: prev.profile.name,
            }),
            email: profileRow.email ?? prev.profile.email,
            roleId: (profileRow.role_id as RoleId) ?? prev.profile.roleId,
            level: profileRow.level ?? prev.profile.level,
            xp: profileRow.xp ?? prev.profile.xp,
            xpToNextLevel: profileRow.xp_to_next_level ?? prev.profile.xpToNextLevel,
            xpTotal: profileRow.xp_total ?? prev.profile.xpTotal,
            xpField: profileRow.xp_field ?? prev.profile.xpField,
            reputation: profileRow.reputation ?? prev.profile.reputation,
            cachet: profileRow.cachet ?? prev.profile.cachet,
            profileImage: profileRow.profile_image ?? prev.profile.profileImage,
            lastActivityAt: profileRow.last_activity_at ? new Date(profileRow.last_activity_at).getTime() : Date.now(),
          },
          turns: remoteTurns,
          activityProgress: remoteActivityProgress,
        }));
      }

      if (profileRow || !profileRes.error) {
        setHasHydratedRemote(true);
      }
    };

    loadRemoteState();

    return () => {
      isMounted = false;
    };
  }, [authUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;

    const mapTurnRow = (turn: any): TurnRecord => ({
      id: turn.id,
      eventId: turn.event_id ?? '',
      eventName: normalizeText(turn.event_name),
      theatre: normalizeText(turn.theatre),
      date: normalizeText(turn.event_date),
      time: normalizeText(turn.event_time),
      roleId: (turn.role_id as RoleId) ?? 'attore',
      rewards: {
        xp: Number(turn.rewards?.xp ?? 0),
        reputation: Number(turn.rewards?.reputation ?? 0),
        cachet: Number(turn.rewards?.cachet ?? 0),
      },
      createdAt: turn.created_at ? new Date(turn.created_at).getTime() : Date.now(),
    });

    const channel = supabase
      .channel(`tdp-mobile-${authUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${authUserId}` },
        (payload) => {
          if (!payload.new) return;
          const profile = payload.new as any;
          setState((prev: GameState) => ({
            ...prev,
            profile: {
              ...prev.profile,
              name: resolveDisplayName({
                name: profile.name,
                email: profile.email ?? prev.profile.email,
                fallback: prev.profile.name,
              }),
              email: profile.email ?? prev.profile.email,
              roleId: (profile.role_id as RoleId) ?? prev.profile.roleId,
              level: profile.level ?? prev.profile.level,
              xp: profile.xp ?? prev.profile.xp,
              xpToNextLevel: profile.xp_to_next_level ?? prev.profile.xpToNextLevel,
              xpTotal: profile.xp_total ?? prev.profile.xpTotal,
              xpField: profile.xp_field ?? prev.profile.xpField,
              reputation: profile.reputation ?? prev.profile.reputation,
              cachet: profile.cachet ?? prev.profile.cachet,
              profileImage: profile.profile_image ?? prev.profile.profileImage,
              lastActivityAt: profile.last_activity_at ? new Date(profile.last_activity_at).getTime() : prev.profile.lastActivityAt,
            },
          }));
          setHasHydratedRemote(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turns', filter: `user_id=eq.${authUserId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const nextTurn = mapTurnRow(payload.new);
            setState((prev: GameState) => {
              if (prev.turns.some((turn: TurnRecord) => turn.id === nextTurn.id)) {
                return prev;
              }
              const merged = [nextTurn, ...prev.turns].sort((a: TurnRecord, b: TurnRecord) => b.createdAt - a.createdAt);
              return { ...prev, turns: merged.slice(0, MAX_TURNS) };
            });
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const nextTurn = mapTurnRow(payload.new);
            setState((prev: GameState) => ({
              ...prev,
              turns: prev.turns
                .map((turn: TurnRecord) => (turn.id === nextTurn.id ? nextTurn : turn))
                .sort((a: TurnRecord, b: TurnRecord) => b.createdAt - a.createdAt),
            }));
          }

          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as any).id as string | undefined;
            if (!deletedId) return;
            setState((prev: GameState) => ({
              ...prev,
              turns: prev.turns.filter((turn: TurnRecord) => turn.id !== deletedId),
            }));
          }

          refreshTurnStats();
          refreshTheatreReputation();
          refreshBadges();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshBadges();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_progress', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshActivityProgress();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'followed_events', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshFollowedEvents(catalog.events);
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [
    authUserId,
    catalog.events,
    refreshActivityProgress,
    refreshBadges,
    refreshFollowedEvents,
    refreshTheatreReputation,
    refreshTurnStats,
  ]);

  const persistProfile = useCallback(
    (profile: PlayerProfile) => {
      if (!supabase || !authUserId || !hasHydratedRemote) return;
      supabase
        .from('profiles')
        .upsert(
          {
            id: authUserId,
            name: profile.name,
            email: profile.email,
            role_id: profile.roleId,
            level: profile.level,
            xp: profile.xp,
            xp_to_next_level: profile.xpToNextLevel,
            xp_total: profile.xpTotal,
            xp_field: profile.xpField,
            reputation: profile.reputation,
            cachet: profile.cachet,
            profile_image: profile.profileImage,
            last_activity_at: new Date(profile.lastActivityAt).toISOString(),
          },
          { onConflict: 'id' }
        )
        .then(({ error }) => {
          if (error) {
            console.warn('Supabase profile upsert failed', error);
          }
        });
    },
    [authUserId, hasHydratedRemote]
  );

  const persistActivityProgress = useCallback(
    (activityId: string, progress: ActivityProgress) => {
      if (!supabase || !authUserId || !hasHydratedRemote) return;
      supabase
        .from('activity_progress')
        .upsert(
          {
            user_id: authUserId,
            activity_id: activityId,
            runs_count_session: progress.runsCountSession,
            session_started_at: progress.sessionStartedAt
              ? new Date(progress.sessionStartedAt).toISOString()
              : null,
            last_played_at: progress.lastPlayedAt
              ? new Date(progress.lastPlayedAt).toISOString()
              : null,
            best_score: progress.bestScore ?? null,
            last_score: progress.lastScore ?? null,
          },
          { onConflict: 'user_id,activity_id' }
        )
        .then(({ error }) => {
          if (error) {
            console.warn('Supabase activity progress upsert failed', error);
          }
        });
    },
    [authUserId, hasHydratedRemote]
  );

  const updateProfile = useCallback(
    (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId' | 'profileImage'>>) => {
      let nextProfile: PlayerProfile | null = null;
      setState((prev: GameState) => {
        const nextRole =
          updates.roleId && catalog.roles.some((role: Role) => role.id === updates.roleId)
            ? updates.roleId
            : prev.profile.roleId;
        nextProfile = { ...prev.profile, ...updates, roleId: nextRole ?? prev.profile.roleId };
        return {
          ...prev,
          profile: nextProfile,
        };
      });
      if (nextProfile) {
        persistProfile(nextProfile);
      }
    },
    [catalog.roles, persistProfile]
  );

  const registerTurn = useCallback(
    (eventId: string, roleId: RoleId): TurnRecord | null => {
      const event = catalog.events.find((item) => item.id === eventId) ?? catalog.events[0];
      if (!event) return null;
      const rewards = computeTurnRewards(event, roleId);
      const turnId =
        supabase && authUserId && globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `turn-${Date.now()}`;
      const record: TurnRecord = {
        id: turnId,
        eventId: event.id,
        eventName: event.name,
        theatre: event.theatre,
        date: event.date,
        time: event.time,
        roleId,
        rewards,
        createdAt: Date.now(),
      };

      let nextProfile: PlayerProfile | null = null;
      setState((prev: GameState) => {
        nextProfile = applyRewards(prev.profile, rewards, 'turn');
        return {
          ...prev,
          profile: nextProfile,
          turns: [record, ...prev.turns].slice(0, MAX_TURNS),
        };
      });

      if (nextProfile) {
        persistProfile(nextProfile);
      }

      if (supabase && authUserId) {
        supabase
          .from('turns')
          .insert({
            id: turnId,
            user_id: authUserId,
            event_id: event.id,
            event_name: event.name,
            theatre: event.theatre,
            event_date: event.date,
            event_time: event.time,
            role_id: roleId,
            rewards,
          })
          .then(({ error }) => {
            if (error) {
              console.warn('Supabase turn insert failed', error);
            }
          });
      }

      return record;
    },
    [catalog.events, authUserId, persistProfile]
  );

  const getAvailabilityForActivity = useCallback(
    (activityId: string) => {
      const activity = catalog.activities.find((item) => item.id === activityId);
      if (!activity) {
        return {
          canPlay: false,
          reason: 'session_limit' as const,
          remainingSeconds: 0,
          runsUsed: 0,
          runsRemaining: 0,
          maxRunsPerSession: 0,
          cooldownSeconds: 0,
        };
      }
      return getActivityAvailability(activity, activityProgress[activityId], Date.now());
    },
    [activityProgress, catalog.activities]
  );

  const completeActivity = useCallback(
    (activityId: string, score?: number): ActivityCompletionResult => {
      const activity = catalog.activities.find((item) => item.id === activityId);
      if (!activity) {
        return { ok: false, reason: 'missing_activity' };
      }

      const now = Date.now();
      const currentProgress = normalizeActivityProgress(activityProgress[activityId], now);
      const availability = getActivityAvailability(activity, currentProgress, now);
      if (!availability.canPlay) {
        return {
          ok: false,
          reason: availability.reason === 'cooldown' ? 'cooldown' : 'session_limit',
          availability,
        };
      }

      const rewards: Rewards = {
        xp: activity.xpReward,
        cachet: activity.cachetReward,
        reputation: activity.reputationReward,
      };

      const normalizedScore =
        typeof score === 'number' && Number.isFinite(score)
          ? Math.max(0, Math.min(100, Math.round(score)))
          : undefined;
      const nextProgress: ActivityProgress = {
        runsCountSession: currentProgress.runsCountSession + 1,
        sessionStartedAt: currentProgress.sessionStartedAt ?? now,
        lastPlayedAt: now,
        bestScore:
          normalizedScore == null
            ? currentProgress.bestScore
            : Math.max(currentProgress.bestScore ?? normalizedScore, normalizedScore),
        lastScore: normalizedScore ?? currentProgress.lastScore,
      };

      let nextProfile: PlayerProfile | null = null;
      const completionId =
        supabase && authUserId && globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `activity-${Date.now()}`;

      setState((prev: GameState) => {
        nextProfile = applyRewards(prev.profile, rewards, 'activity');
        return {
          ...prev,
          profile: nextProfile,
          activityProgress: {
            ...prev.activityProgress,
            [activity.id]: nextProgress,
          },
        };
      });

      setRemoteActivityProgress((prev) => ({
        ...prev,
        [activity.id]: nextProgress,
      }));

      if (nextProfile) {
        persistProfile(nextProfile);
      }
      persistActivityProgress(activity.id, nextProgress);

      if (supabase && authUserId) {
        supabase
          .from('activity_completions')
          .insert({
            id: completionId,
            user_id: authUserId,
            activity_id: activity.id,
            rewards,
            score: normalizedScore ?? null,
          })
          .then(({ error }) => {
            if (error) {
              console.warn('Supabase activity insert failed', error);
            }
          });
      }

      const nextAvailability = getActivityAvailability(activity, nextProgress, now);
      return {
        ok: true,
        activity,
        rewards,
        availability: nextAvailability,
      };
    },
    [activityProgress, authUserId, catalog.activities, persistActivityProgress, persistProfile]
  );

  const resetProgress = useCallback(async () => {
    if (isSupabaseConfigured && supabase && authUserId) {
      const { error } = await supabase.rpc('reset_my_progress');
      if (error) throw error;
    }

    setState((prev: GameState) => ({
      ...prev,
      profile: {
        ...prev.profile,
        roleId: 'attore',
        level: 1,
        xp: 0,
        xpToNextLevel: 1000,
        xpTotal: 0,
        xpField: 0,
        reputation: 0,
        cachet: 0,
      },
      turns: [],
      activityProgress: {},
    }));

    setRemoteActivityProgress({});

    if (isSupabaseConfigured && supabase && authUserId) {
      await Promise.all([
        refreshTurnStats(),
        refreshTheatreReputation(),
        refreshBadges(),
        refreshActivityProgress(),
      ]);
    }
  }, [authUserId, refreshActivityProgress, refreshBadges, refreshTheatreReputation, refreshTurnStats]);

  const changePassword = useCallback(
    async (newPassword: string, currentPassword?: string) => {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase non configurato');
      }
      if (!authUserId) {
        throw new Error('Devi essere autenticato per cambiare la password');
      }

      if (currentPassword) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const email = sessionData.session?.user.email;
        if (!email) {
          throw new Error('Email mancante');
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (signInError) {
          throw new Error('Password attuale non valida');
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    [authUserId]
  );

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase non configurato');
    }
    if (!email) {
      throw new Error('Email mancante');
    }

    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );
    if (error) throw error;
  }, []);

  const resetState = useCallback(() => {
    const next = createDefaultState();
    setState(next);
  }, []);

  // Gestione decadimento reputazione per inattività
  useEffect(() => {
    if (!state.profile || state.profile.reputation <= 0) return;

    const checkReputationDecay = () => {
      const now = Date.now();
      const lastActivity = state.profile.lastActivityAt;
      const daysInactive = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

      // Se inattivo per più di 14 giorni, perde 2 punti di reputazione al giorno extra
      if (daysInactive > 14) {
        const decayDays = daysInactive - 14;
        const totalDecay = decayDays * 2;

        if (totalDecay > 0) {
          setState((prev: GameState) => {
            const currentRep = prev.profile.reputation;
            const newRep = Math.max(0, currentRep - totalDecay);

            if (newRep === currentRep) return prev; // Evita loop infiniti se non cambia nulla

            return {
              ...prev,
              profile: {
                ...prev.profile,
                reputation: newRep,
              }
            };
          });
        }
      }
    };

    // Controllo ogni ora
    const interval = setInterval(checkReputationDecay, 1000 * 60 * 60);
    checkReputationDecay();

    return () => clearInterval(interval);
  }, [state.profile.lastActivityAt, state.profile.reputation]);

  const value = useMemo<GameContextValue>(
    () => ({
      authUserId,
      authReady,
      hasHydratedRemote,
      state,
      roles: catalog.roles,
      events: catalog.events,
      activities: catalog.activities,
      turnStats,
      statsLoading,
      theatreReputation,
      theatreReputationLoading,
      leaderboard,
      leaderboardLoading,
      refreshLeaderboard,
      badges,
      badgesLoading,
      followedEvents,
      followedEventsLoading,
      followEvent,
      unfollowEvent,
      isEventFollowed,
      markBadgesSeen,
      updateProfile,
      registerTurn,
      getActivityAvailability: getAvailabilityForActivity,
      completeActivity,
      resetProgress,
      changePassword,
      sendPasswordResetEmail,
      resetState,
    }),
    [
      authUserId,
      authReady,
      hasHydratedRemote,
      state,
      catalog,
      turnStats,
      statsLoading,
      theatreReputation,
      theatreReputationLoading,
      leaderboard,
      leaderboardLoading,
      refreshLeaderboard,
      badges,
      badgesLoading,
      followedEvents,
      followedEventsLoading,
      followEvent,
      unfollowEvent,
      isEventFollowed,
      markBadgesSeen,
      updateProfile,
      registerTurn,
      getAvailabilityForActivity,
      completeActivity,
      resetProgress,
      changePassword,
      sendPasswordResetEmail,
      resetState,
    ]
  );

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return ctx;
}
