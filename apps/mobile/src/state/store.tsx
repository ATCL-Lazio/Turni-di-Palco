import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type RoleId = 'attore' | 'luci' | 'fonico' | 'attrezzista' | 'palco';
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

export type Activity = {
  id: string;
  title: string;
  description: string;
  duration: string;
  xpReward: number;
  cachetReward: number;
  difficulty: 'Facile' | 'Medio' | 'Difficile';
};

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

type PlayerProfile = {
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
};

export type GameState = {
  profile: PlayerProfile;
  turns: TurnRecord[];
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
    description: "La compagnia è in ritardo di 20 minuti. Devi gestire il clima e chiudere la prova.",
    duration: '5 min',
    xpReward: 50,
    cachetReward: 20,
    difficulty: 'Medio',
  },
  {
    id: 'audio',
    title: 'Prova audio critica',
    description: 'Un rientro micro crea Larsen. Il tempo stringe prima dell’apertura porte.',
    duration: '6 min',
    xpReward: 60,
    cachetReward: 25,
    difficulty: 'Difficile',
  },
  {
    id: 'palco',
    title: 'Cambio scena rapido',
    description: 'Il cambio scena tra due atti è più lento del previsto. Serve velocizzare.',
    duration: '4 min',
    xpReward: 55,
    cachetReward: 22,
    difficulty: 'Medio',
  },
  {
    id: 'recitazione',
    title: 'Prova di recitazione',
    description: 'Esercita le tue abilità di interpretazione con un monologo classico.',
    duration: '5 min',
    xpReward: 45,
    cachetReward: 18,
    difficulty: 'Facile',
  },
];

const STORAGE_KEY = 'tdp-mobile-ui-state';
const MAX_TURNS = 20;

function createDefaultState(): GameState {
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
  };
}

function loadState(): GameState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.profile) return createDefaultState();
    const safeRole = roles.some((role) => role.id === parsed.profile.roleId) ? parsed.profile.roleId : createDefaultState().profile.roleId;
    return {
      profile: {
        ...createDefaultState().profile,
        ...parsed.profile,
        roleId: safeRole,
      },
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
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
  state: GameState;
  roles: Role[];
  events: GameEvent[];
  activities: Activity[];
  updateProfile: (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId'>>) => void;
  registerTurn: (eventId: string, roleId: RoleId) => TurnRecord | null;
  completeActivity: (activityId: string) => { activity: Activity; rewards: Rewards } | null;
  resetState: () => void;
};

const GameStateContext = createContext<GameContextValue | undefined>(undefined);

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updateProfile = useCallback((updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId'>>) => {
    setState((prev) => {
      const nextRole = updates.roleId && roles.some((role) => role.id === updates.roleId) ? updates.roleId : prev.profile.roleId;
      return {
        ...prev,
        profile: { ...prev.profile, ...updates, roleId: nextRole ?? prev.profile.roleId },
      };
    });
  }, []);

  const registerTurn = useCallback((eventId: string, roleId: RoleId): TurnRecord | null => {
    const event = events.find((item) => item.id === eventId) ?? events[0];
    if (!event) return null;
    const rewards = computeTurnRewards(event, roleId);
    const record: TurnRecord = {
      id: `turn-${Date.now()}`,
      eventId: event.id,
      eventName: event.name,
      theatre: event.theatre,
      date: event.date,
      time: event.time,
      roleId,
      rewards,
      createdAt: Date.now(),
    };

    setState((prev) => ({
      profile: applyRewards(prev.profile, rewards, 'turn'),
      turns: [record, ...prev.turns].slice(0, MAX_TURNS),
    }));

    return record;
  }, []);

  const completeActivity = useCallback((activityId: string) => {
    const activity = activities.find((item) => item.id === activityId);
    if (!activity) return null;
    const rewards: Rewards = { xp: activity.xpReward, cachet: activity.cachetReward, reputation: 5 };
    setState((prev) => ({
      ...prev,
      profile: applyRewards(prev.profile, rewards, 'activity'),
    }));
    return { activity, rewards };
  }, []);

  const resetState = useCallback(() => {
    const next = createDefaultState();
    setState(next);
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      roles,
      events,
      activities,
      updateProfile,
      registerTurn,
      completeActivity,
      resetState,
    }),
    [state, updateProfile, registerTurn, completeActivity, resetState]
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
