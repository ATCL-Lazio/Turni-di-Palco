import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  LEGACY_SUPABASE_SESSION_ID_KEY,
  LEGACY_SUPABASE_SESSION_KEY,
  SUPABASE_SESSION_ID_KEY,
  SUPABASE_SESSION_KEY,
} from '../lib/auth-storage';
import type { EventPlanning, GameState } from './types';
import { events } from './catalog';
import { isRecord, isRoleId } from './normalizers';
import { resolveEventPlanningStatus } from './event-planning';

export const STORAGE_KEY = 'tdp-mobile-ui-state';
const TUTORIAL_COMPLETED_KEY_PREFIX = 'tdp-tutorial-completed:';
// Stable anonymous "userId" suffix used to persist tutorial completion in
// demo/guest mode (i.e. when authUserId is null). The real localStorage key
// becomes `${TUTORIAL_COMPLETED_KEY_PREFIX}${TUTORIAL_ANON_ID}`. It is
// migrated to the real user key on first login so that completing the tutorial
// before signing in is not lost (closes #1316).
export const TUTORIAL_ANON_ID = 'anon';

function tutorialCompletedKey(userId: string): string {
  return `${TUTORIAL_COMPLETED_KEY_PREFIX}${userId}`;
}

export function readTutorialCompleted(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(tutorialCompletedKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function writeTutorialCompleted(userId: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const key = tutorialCompletedKey(userId);
    if (value) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

type StoredSession = { access_token: string; refresh_token: string; user_id?: string };

export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const keys = [SUPABASE_SESSION_KEY, LEGACY_SUPABASE_SESSION_KEY];
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed.access_token || !parsed.refresh_token) continue;
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function persistStoredSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  try {
    const sessionKeys = [SUPABASE_SESSION_KEY, LEGACY_SUPABASE_SESSION_KEY];
    const sessionIdKeys = [SUPABASE_SESSION_ID_KEY, LEGACY_SUPABASE_SESSION_ID_KEY];

    if (!session) {
      sessionKeys.forEach((key) => window.localStorage.removeItem(key));
      sessionIdKeys.forEach((key) => window.localStorage.removeItem(key));
      return;
    }
    const payload: StoredSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: session.user.id,
    };
    window.localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(payload));
    window.localStorage.setItem(SUPABASE_SESSION_ID_KEY, session.user.id);
    // Cleanup unscoped legacy keys to avoid cross-project token bleed.
    window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
    window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_ID_KEY);
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
      tokenAtcl: 0,
      extraActivitySlots: 0,
      profileImage: undefined,
      lastActivityAt: Date.now(),
      leaderboardVisible: true,
      tutorialCompleted: false,
      onboardingCompletedAt: null,
      onboardingVariant: null,
      skills: { precision: 0, presence: 0, creativity: 0, leadership: 0 },
      completedCourses: {},
      activeCourses: {},
    },
    turns: [],
    eventPlans: [],
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
      xpToNextLevel: 1800, // 800 + 5*200
      xpTotal: 3500,
      xpField: 1800,
      reputation: 75,
      cachet: 250,
      tokenAtcl: 3,
      extraActivitySlots: 1,
      profileImage: undefined,
      lastActivityAt: Date.now(),
      leaderboardVisible: true,
      tutorialCompleted: false,
      onboardingCompletedAt: null,
      onboardingVariant: null,
      skills: { precision: 0, presence: 0, creativity: 0, leadership: 0 },
      completedCourses: {},
      activeCourses: {},
    },
    // Turni/piani demo solo se il fallback locale espone un evento. Con il
    // catalogo mock rimosso (eventi reali dal solo importer) questi restano
    // vuoti, equivalenti a un account nuovo.
    turns: events[0]
      ? [
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
        ]
      : [],
    eventPlans: events[0]
      ? [
          {
            eventId: events[0].id,
            roleId: 'attore',
            status: 'planned',
            updatedAt: Date.now() - 1000 * 60 * 60 * 24,
          },
        ]
      : [],
  };
}

export function createDefaultState(): GameState {
  if (isSupabaseConfigured) return createInitialState();
  return import.meta.env.DEV ? createDemoState() : createInitialState();
}

export function loadState(): GameState {
  if (isSupabaseConfigured) return createInitialState();
  if (!import.meta.env.DEV) return createInitialState();
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.profile) return createDefaultState();
    const safeRole = isRoleId(parsed.profile.roleId) ? parsed.profile.roleId : createDefaultState().profile.roleId;
    return {
      profile: {
        ...createDefaultState().profile,
        ...parsed.profile,
        roleId: safeRole,
      },
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      eventPlans: Array.isArray(parsed.eventPlans)
        ? parsed.eventPlans
          .filter((plan): plan is EventPlanning & { status?: unknown } => isRecord(plan))
          .map((plan) => {
            const roleId = isRoleId(plan.roleId) ? plan.roleId : safeRole;
            const updatedAt =
              typeof plan.updatedAt === 'number' && Number.isFinite(plan.updatedAt)
                ? plan.updatedAt
                : Date.now();
            return {
              eventId: typeof plan.eventId === 'string' ? plan.eventId : '',
              roleId,
              status: resolveEventPlanningStatus(plan.status),
              updatedAt,
            };
          })
          .filter((plan) => plan.eventId)
        : [],
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: GameState) {
  if (typeof window === 'undefined') return;
  try {
    // In demo mode (no Supabase) the user has not authenticated; do not
    // persist their email address to localStorage (GDPR / PII hygiene, closes #1601).
    const persisted = isSupabaseConfigured
      ? state
      : { ...state, profile: { ...state.profile, email: '' } };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // ignore storage errors
  }
}
