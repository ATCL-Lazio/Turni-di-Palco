import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

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

type CatalogState = {
  roles: Role[];
  events: GameEvent[];
  activities: Activity[];
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
  const [catalog, setCatalog] = useState<CatalogState>(() => ({
    roles,
    events,
    activities,
  }));
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setAuthUserId(data.session?.user.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthUserId(session?.user.id ?? null);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    const loadCatalog = async () => {
      const [rolesRes, eventsRes, activitiesRes] = await Promise.all([
        supabase.from('roles').select('id,name,focus,stats'),
        supabase
          .from('events')
          .select('id,name,theatre,event_date,event_time,genre,base_rewards,focus_role'),
        supabase
          .from('activities')
          .select('id,title,description,duration,xp_reward,cachet_reward,difficulty'),
      ]);

      if (!isMounted) return;

      const nextRoles =
        rolesRes.error || !rolesRes.data?.length
          ? roles
          : rolesRes.data.map((role) => ({
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
          ? events
          : eventsRes.data.map((event) => ({
              id: event.id,
              name: event.name,
              theatre: event.theatre,
              date: event.event_date,
              time: event.event_time,
              genre: event.genre,
              baseRewards: {
                xp: Number(event.base_rewards?.xp ?? 0),
                reputation: Number(event.base_rewards?.reputation ?? 0),
                cachet: Number(event.base_rewards?.cachet ?? 0),
              },
              focusRole: event.focus_role ?? undefined,
            }));

      const nextActivities =
        activitiesRes.error || !activitiesRes.data?.length
          ? activities
          : activitiesRes.data.map((activity) => ({
              id: activity.id,
              title: activity.title,
              description: activity.description,
              duration: activity.duration,
              xpReward: activity.xp_reward,
              cachetReward: activity.cachet_reward,
              difficulty: activity.difficulty as Activity['difficulty'],
            }));

      setCatalog({
        roles: nextRoles,
        events: nextEvents,
        activities: nextActivities,
      });
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
      const [profileRes, turnsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', authUserId).single(),
        supabase.from('turns').select('*').eq('user_id', authUserId).order('created_at', { ascending: false }),
      ]);

      if (!isMounted) return;

      if (profileRes.data) {
        setState((prev) => {
          const remoteTurns = Array.isArray(turnsRes.data)
            ? turnsRes.data.map((turn) => ({
                id: turn.id,
                eventId: turn.event_id ?? '',
                eventName: turn.event_name ?? '',
                theatre: turn.theatre ?? '',
                date: turn.event_date ?? '',
                time: turn.event_time ?? '',
                roleId: (turn.role_id as RoleId) ?? 'attore',
                rewards: {
                  xp: Number(turn.rewards?.xp ?? 0),
                  reputation: Number(turn.rewards?.reputation ?? 0),
                  cachet: Number(turn.rewards?.cachet ?? 0),
                },
                createdAt: new Date(turn.created_at).getTime(),
              }))
            : null;

          return {
            profile: {
              ...prev.profile,
              name: profileRes.data.name ?? prev.profile.name,
              email: profileRes.data.email ?? prev.profile.email,
              roleId: (profileRes.data.role_id as RoleId) ?? prev.profile.roleId,
              level: profileRes.data.level ?? prev.profile.level,
              xp: profileRes.data.xp ?? prev.profile.xp,
              xpToNextLevel: profileRes.data.xp_to_next_level ?? prev.profile.xpToNextLevel,
              xpTotal: profileRes.data.xp_total ?? prev.profile.xpTotal,
              xpField: profileRes.data.xp_field ?? prev.profile.xpField,
              reputation: profileRes.data.reputation ?? prev.profile.reputation,
              cachet: profileRes.data.cachet ?? prev.profile.cachet,
            },
            turns: remoteTurns && remoteTurns.length > 0 ? remoteTurns : prev.turns,
          };
        });
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
      eventName: turn.event_name ?? '',
      theatre: turn.theatre ?? '',
      date: turn.event_date ?? '',
      time: turn.event_time ?? '',
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
          setState((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              name: profile.name ?? prev.profile.name,
              email: profile.email ?? prev.profile.email,
              roleId: (profile.role_id as RoleId) ?? prev.profile.roleId,
              level: profile.level ?? prev.profile.level,
              xp: profile.xp ?? prev.profile.xp,
              xpToNextLevel: profile.xp_to_next_level ?? prev.profile.xpToNextLevel,
              xpTotal: profile.xp_total ?? prev.profile.xpTotal,
              xpField: profile.xp_field ?? prev.profile.xpField,
              reputation: profile.reputation ?? prev.profile.reputation,
              cachet: profile.cachet ?? prev.profile.cachet,
            },
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turns', filter: `user_id=eq.${authUserId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const nextTurn = mapTurnRow(payload.new);
            setState((prev) => {
              if (prev.turns.some((turn) => turn.id === nextTurn.id)) {
                return prev;
              }
              const merged = [nextTurn, ...prev.turns].sort((a, b) => b.createdAt - a.createdAt);
              return { ...prev, turns: merged.slice(0, MAX_TURNS) };
            });
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const nextTurn = mapTurnRow(payload.new);
            setState((prev) => ({
              ...prev,
              turns: prev.turns
                .map((turn) => (turn.id === nextTurn.id ? nextTurn : turn))
                .sort((a, b) => b.createdAt - a.createdAt),
            }));
          }

          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as any).id as string | undefined;
            if (!deletedId) return;
            setState((prev) => ({
              ...prev,
              turns: prev.turns.filter((turn) => turn.id !== deletedId),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  const persistProfile = useCallback(
    (profile: PlayerProfile) => {
      if (!supabase || !authUserId) return;
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
          },
          { onConflict: 'id' }
        )
        .then(({ error }) => {
          if (error) {
            console.warn('Supabase profile upsert failed', error);
          }
        });
    },
    [authUserId]
  );

  const updateProfile = useCallback(
    (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId'>>) => {
      let nextProfile: PlayerProfile | null = null;
      setState((prev) => {
        const nextRole =
          updates.roleId && catalog.roles.some((role) => role.id === updates.roleId)
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
      setState((prev) => {
        nextProfile = applyRewards(prev.profile, rewards, 'turn');
        return {
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

  const completeActivity = useCallback(
    (activityId: string) => {
      const activity = catalog.activities.find((item) => item.id === activityId);
      if (!activity) return null;
      const rewards: Rewards = { xp: activity.xpReward, cachet: activity.cachetReward, reputation: 5 };

      let nextProfile: PlayerProfile | null = null;
      const completionId =
        supabase && authUserId && globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `activity-${Date.now()}`;
      setState((prev) => {
        nextProfile = applyRewards(prev.profile, rewards, 'activity');
        return {
          ...prev,
          profile: nextProfile,
        };
      });

      if (nextProfile) {
        persistProfile(nextProfile);
      }

      if (supabase && authUserId) {
        supabase
          .from('activity_completions')
          .insert({ id: completionId, user_id: authUserId, activity_id: activity.id, rewards })
          .then(({ error }) => {
            if (error) {
              console.warn('Supabase activity insert failed', error);
            }
          });
      }

      return { activity, rewards };
    },
    [catalog.activities, authUserId, persistProfile]
  );

  const resetState = useCallback(() => {
    const next = createDefaultState();
    setState(next);
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      roles: catalog.roles,
      events: catalog.events,
      activities: catalog.activities,
      updateProfile,
      registerTurn,
      completeActivity,
      resetState,
    }),
    [state, catalog, updateProfile, registerTurn, completeActivity, resetState]
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
