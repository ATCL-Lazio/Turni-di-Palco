import {
  MOBILE_FEATURE_FLAG_KEYS as SHARED_MOBILE_FEATURE_FLAG_KEYS,
  type MobileFeatureFlagKey,
} from "../../../../shared/flags/catalog";
import {
  pickBooleanOverrides,
  readVercelFlagOverridesFromDocument,
} from "../../../../shared/flags/vercel-overrides";

export const MOBILE_FEATURE_FLAG_KEYS = SHARED_MOBILE_FEATURE_FLAG_KEYS;

export type { MobileFeatureFlagKey };
export type MobileFeatureFlagsState = Record<MobileFeatureFlagKey, boolean>;
export type MobileFeatureFlagsSource = "remote" | "cache" | "default" | "vercel";

const MOBILE_FEATURE_FLAG_CACHE_KEY = "tdp-mobile-feature-flags:v1";

const buildFlagState = (value: boolean): MobileFeatureFlagsState =>
  MOBILE_FEATURE_FLAG_KEYS.reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as MobileFeatureFlagsState);

export const MOBILE_FEATURE_FLAGS_FAIL_CLOSED = buildFlagState(false);
export const MOBILE_FEATURE_FLAGS_ALL_ON = buildFlagState(true);
export const MOBILE_FEATURE_FLAGS_DEFAULTS: MobileFeatureFlagsState = {
  ...MOBILE_FEATURE_FLAGS_ALL_ON,
  "mobile.dev.ticket_qr_prototype": false,
};

export type MobileFeatureFlagRow = {
  key: string;
  enabled: boolean;
};

export function isMobileFeatureFlagKey(value: string): value is MobileFeatureFlagKey {
  return (MOBILE_FEATURE_FLAG_KEYS as readonly string[]).includes(value);
}

export function normalizeMobileFeatureFlags(rows: unknown): MobileFeatureFlagsState | null {
  if (!Array.isArray(rows)) return null;

  const next: MobileFeatureFlagsState = { ...MOBILE_FEATURE_FLAGS_DEFAULTS };
  let hasKnownKey = false;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rowData = row as Partial<MobileFeatureFlagRow>;
    if (typeof rowData.key !== "string" || !isMobileFeatureFlagKey(rowData.key)) continue;

    next[rowData.key] = Boolean(rowData.enabled);
    hasKnownKey = true;
  }

  return hasKnownKey ? next : null;
}

export function readVercelMobileFeatureFlagOverrides(): Partial<MobileFeatureFlagsState> {
  const rawOverrides = readVercelFlagOverridesFromDocument();
  return pickBooleanOverrides(MOBILE_FEATURE_FLAG_KEYS, rawOverrides);
}

function parseList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readEnvFeatureFlagOverrides(): Partial<MobileFeatureFlagsState> {
  const overrides: Partial<MobileFeatureFlagsState> = {};
  const enabled = new Set(parseList(import.meta.env.VITE_FEATURE_FLAGS));
  const disabled = new Set(parseList(import.meta.env.VITE_DISABLED_FEATURE_FLAGS));

  MOBILE_FEATURE_FLAG_KEYS.forEach((flag) => {
    if (enabled.has(flag)) overrides[flag] = true;
    if (disabled.has(flag)) overrides[flag] = false;
  });

  return overrides;
}

export function applyMobileFeatureFlagOverrides(
  baseline: MobileFeatureFlagsState,
  overrides: Partial<MobileFeatureFlagsState>
): MobileFeatureFlagsState {
  if (!Object.keys(overrides).length) return { ...baseline };
  return {
    ...baseline,
    ...overrides,
  };
}

export function readMobileFeatureFlagsCache(): MobileFeatureFlagsState | null {
  if (typeof window === "undefined") return null;
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
  if (typeof window === "undefined") return;
  try {
    const rows = MOBILE_FEATURE_FLAG_KEYS.map((key) => ({ key, enabled: Boolean(flags[key]) }));
    window.localStorage.setItem(MOBILE_FEATURE_FLAG_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // ignore cache write errors
  }
}

export function clearMobileFeatureFlagsCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MOBILE_FEATURE_FLAG_CACHE_KEY);
  } catch {
    // ignore cache removal errors
  }
}
