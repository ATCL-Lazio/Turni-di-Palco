import { isSupabaseConfigured } from './supabase';
import type { Screen } from '../types/navigation';

const LEGACY_SESSION_KEY = 'tdp-supabase-session';
const LEGACY_SESSION_ID_KEY = 'tdp-supabase-session-id';

function resolveSupabaseProjectRef() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (typeof url !== 'string' || !url.trim()) return 'default';

  try {
    const host = new URL(url).host;
    const ref = host.split('.')[0]?.trim();
    return ref || 'default';
  } catch {
    return 'default';
  }
}

const STORAGE_NAMESPACE = resolveSupabaseProjectRef();
export const SUPABASE_SESSION_KEY = `${LEGACY_SESSION_KEY}:${STORAGE_NAMESPACE}`;
export const SUPABASE_SESSION_ID_KEY = `${LEGACY_SESSION_ID_KEY}:${STORAGE_NAMESPACE}`;
export const LEGACY_SUPABASE_SESSION_KEY = LEGACY_SESSION_KEY;
export const LEGACY_SUPABASE_SESSION_ID_KEY = LEGACY_SESSION_ID_KEY;
export const USER_STATE_KEY = 'tdp-mobile-ui-state';

export const PUBLIC_SCREENS = new Set<Screen>(['cookie-consent', 'welcome', 'login', 'signup', 'install', 'terms', 'privacy']);

type StoredSession = { access_token?: unknown; refresh_token?: unknown };
type StoredUserState = { profile?: { email?: unknown } };

function hasStoredSupabaseSession() {
  if (typeof window === 'undefined') return false;
  try {
    if (
      window.localStorage.getItem(SUPABASE_SESSION_ID_KEY) ||
      window.localStorage.getItem(LEGACY_SUPABASE_SESSION_ID_KEY)
    ) {
      return true;
    }

    for (const key of [SUPABASE_SESSION_KEY, LEGACY_SUPABASE_SESSION_KEY]) {
      const storedSessionRaw = window.localStorage.getItem(key);
      if (!storedSessionRaw) continue;
      const parsed = JSON.parse(storedSessionRaw) as StoredSession;
      if (typeof parsed.access_token === 'string' && typeof parsed.refresh_token === 'string') {
        return true;
      }
    }

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function hasStoredUserEmail() {
  if (typeof window === 'undefined') return false;
  try {
    const storedUserStateRaw = window.localStorage.getItem(USER_STATE_KEY);
    if (!storedUserStateRaw) return false;
    const parsed = JSON.parse(storedUserStateRaw) as StoredUserState;
    const email = parsed.profile?.email;
    return typeof email === 'string' && email.includes('@');
  } catch {
    return false;
  }
}

export function hasStoredAuthState() {
  return isSupabaseConfigured ? hasStoredSupabaseSession() : hasStoredUserEmail();
}
