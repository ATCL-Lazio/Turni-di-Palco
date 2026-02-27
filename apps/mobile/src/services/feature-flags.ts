export const MOBILE_FEATURE_FLAG_KEYS = [
  'mobile.section.turns',
  'mobile.section.leaderboard',
  'mobile.section.activities',
  'mobile.section.shop',
  'mobile.section.career',
  'mobile.section.earned_titles',
  'mobile.action.qr_scan',
  'mobile.action.turn_submit',
  'mobile.action.turn_boost',
  'mobile.action.activity_start',
  'mobile.action.activity_complete',
  'mobile.action.shop_purchase',
] as const;

export type MobileFeatureFlagKey = (typeof MOBILE_FEATURE_FLAG_KEYS)[number];
export type MobileFeatureFlagsState = Record<MobileFeatureFlagKey, boolean>;
export type MobileFeatureFlagsSource = 'remote' | 'cache' | 'default';

const MOBILE_FEATURE_FLAG_CACHE_KEY = 'tdp-mobile-feature-flags:v1';

const buildFlagState = (value: boolean): MobileFeatureFlagsState =>
  MOBILE_FEATURE_FLAG_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as MobileFeatureFlagsState);

export const MOBILE_FEATURE_FLAGS_FAIL_CLOSED = buildFlagState(false);
export const MOBILE_FEATURE_FLAGS_ALL_ON = buildFlagState(true);

export type MobileFeatureFlagRow = {
  key: string;
  enabled: boolean;
};

export function isMobileFeatureFlagKey(value: string): value is MobileFeatureFlagKey {
  return (MOBILE_FEATURE_FLAG_KEYS as readonly string[]).includes(value);
}

export function normalizeMobileFeatureFlags(rows: unknown): MobileFeatureFlagsState | null {
  if (!Array.isArray(rows)) return null;

  const next: MobileFeatureFlagsState = { ...MOBILE_FEATURE_FLAGS_ALL_ON };
  let hasKnownKey = false;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const rowData = row as Partial<MobileFeatureFlagRow>;
    if (typeof rowData.key !== 'string' || !isMobileFeatureFlagKey(rowData.key)) continue;

    next[rowData.key] = Boolean(rowData.enabled);
    hasKnownKey = true;
  }

  return hasKnownKey ? next : null;
}

export function readMobileFeatureFlagsCache(): MobileFeatureFlagsState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MOBILE_FEATURE_FLAG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeMobileFeatureFlags(parsed);
  } catch {
    return null;
  }
}

export function writeMobileFeatureFlagsCache(flags: MobileFeatureFlagsState) {
  if (typeof window === 'undefined') return;
  try {
    const rows = MOBILE_FEATURE_FLAG_KEYS.map((key) => ({ key, enabled: Boolean(flags[key]) }));
    window.localStorage.setItem(MOBILE_FEATURE_FLAG_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // ignore cache write errors
  }
}

export function clearMobileFeatureFlagsCache() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MOBILE_FEATURE_FLAG_CACHE_KEY);
  } catch {
    // ignore cache removal errors
  }
}
