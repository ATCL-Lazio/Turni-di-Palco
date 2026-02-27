export type FeatureFlag = "status-card" | "permissions-card" | "ai-support";
export type ServiceWorkerDevMode = "cleanup" | "register";
export type RuntimeEnvironment = "development" | "production" | "test";

export type FeatureFlagConfig = Record<FeatureFlag, boolean>;
export type FeatureFlagOverride = Partial<FeatureFlagConfig>;

export type RuntimeConfigOverride = {
  publicMode?: boolean;
  controlPlaneBaseUrl?: string;
  featureFlags?: Partial<FeatureFlagConfig>;
  serviceWorker?: {
    devMode?: ServiceWorkerDevMode;
    devCleanupRegistrations?: boolean;
  };
  devGate?: {
    allowedRoles?: string[];
    allowedEmails?: string[];
    serverAccessFunction?: string;
    sessionCacheTtlMs?: number;
    staleCacheGraceMs?: number;
  };
};

export type AppConfig = {
  environment: RuntimeEnvironment;
  isProd: boolean;
  publicMode: boolean;
  supabase: {
    url: string | null;
    anonKey: string | null;
    configured: boolean;
  };
  devGate: {
    allowedRoles: string[];
    allowedEmails: string[];
    serverAccessFunction: string;
    sessionCacheTtlMs: number;
    staleCacheGraceMs: number;
  };
  controlPlane: {
    baseUrl: string;
  };
  serviceWorker: {
    devMode: ServiceWorkerDevMode;
    devCleanupRegistrations: boolean;
  };
  featureFlags: FeatureFlagConfig;
};

const FEATURE_FLAG_KEYS: FeatureFlag[] = ["status-card", "permissions-card", "ai-support"];
const FEATURE_FLAG_STORAGE_KEY = "tdp-pwa-feature-flags:v1";

const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  "status-card": true,
  "permissions-card": true,
  "ai-support": true,
};

const DEFAULT_DEV_ACCESS_FUNCTION = "dev-access";

type EnvSource = Record<string, unknown>;

declare global {
  interface Window {
    __TDP_PWA_CONFIG__?: RuntimeConfigOverride;
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
    if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  }
  return fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseList(value: unknown, fallback: string[] = []): string[] {
  const source = Array.isArray(value) ? value.join(",") : asString(value);
  if (!source) return [...fallback];
  const unique = new Set<string>();
  source
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => unique.add(item));
  return Array.from(unique);
}

function normalizeBase(input: string): string {
  return input.replace(/\/+$/, "");
}

function resolveEnvironment(env: EnvSource): RuntimeEnvironment {
  const mode = asString(env.MODE)?.toLowerCase();
  if (mode === "development" || mode === "production" || mode === "test") {
    return mode;
  }
  return parseBoolean(env.PROD, false) ? "production" : "development";
}

function resolveFeatureFlags(
  env: EnvSource,
  runtimeOverride?: FeatureFlagOverride,
  storedOverride?: FeatureFlagOverride
): FeatureFlagConfig {
  const enabled = new Set(parseList(env.VITE_FEATURE_FLAGS));
  const disabled = new Set(parseList(env.VITE_DISABLED_FEATURE_FLAGS));
  const resolved: FeatureFlagConfig = { ...DEFAULT_FEATURE_FLAGS };

  FEATURE_FLAG_KEYS.forEach((flag) => {
    if (enabled.has(flag)) resolved[flag] = true;
    if (disabled.has(flag)) resolved[flag] = false;
  });

  if (storedOverride) {
    FEATURE_FLAG_KEYS.forEach((flag) => {
      if (typeof storedOverride[flag] === "boolean") {
        resolved[flag] = storedOverride[flag] as boolean;
      }
    });
  }

  if (runtimeOverride) {
    FEATURE_FLAG_KEYS.forEach((flag) => {
      if (typeof runtimeOverride[flag] === "boolean") {
        resolved[flag] = runtimeOverride[flag] as boolean;
      }
    });
  }

  return resolved;
}

function resolveControlPlaneBase(env: EnvSource, origin: string, override?: string): string {
  const fromOverride = asString(override);
  if (fromOverride) return normalizeBase(fromOverride);

  const fromEnv = asString(env.VITE_DEV_CONTROL_PLANE_URL);
  if (fromEnv) return normalizeBase(fromEnv);

  const fallback = asString(origin);
  if (fallback) return normalizeBase(fallback);

  return "";
}

function resolveServiceWorkerDevMode(env: EnvSource, override?: ServiceWorkerDevMode): ServiceWorkerDevMode {
  if (override === "cleanup" || override === "register") return override;
  const raw = asString(env.VITE_SW_DEV)?.toLowerCase();
  if (raw === "register" || raw === "true" || raw === "1") return "register";
  return "cleanup";
}

function readRuntimeOverride(): RuntimeConfigOverride | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__TDP_PWA_CONFIG__;
}

function sanitizeFeatureFlagOverride(value: unknown): FeatureFlagOverride | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const next: FeatureFlagOverride = {};

  FEATURE_FLAG_KEYS.forEach((flag) => {
    if (typeof candidate[flag] === "boolean") {
      next[flag] = candidate[flag] as boolean;
    }
  });

  return Object.keys(next).length ? next : undefined;
}

function readStoredFeatureFlagOverride(): FeatureFlagOverride | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(FEATURE_FLAG_STORAGE_KEY);
    if (!raw) return undefined;
    return sanitizeFeatureFlagOverride(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function writeStoredFeatureFlagOverride(overrides: FeatureFlagOverride) {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeFeatureFlagOverride(overrides);
  if (!sanitized) {
    window.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(sanitized));
}

export function listFeatureFlagKeys(): FeatureFlag[] {
  return [...FEATURE_FLAG_KEYS];
}

export function getRuntimeFeatureFlagBaseline(params?: {
  env?: EnvSource;
  runtimeOverride?: RuntimeConfigOverride;
}): FeatureFlagConfig {
  const env = params?.env ?? (import.meta.env as unknown as EnvSource);
  const runtimeOverride = params?.runtimeOverride ?? readRuntimeOverride();
  return resolveFeatureFlags(env, runtimeOverride?.featureFlags);
}

export function getStoredFeatureFlagOverrides(): FeatureFlagOverride {
  return readStoredFeatureFlagOverride() ?? {};
}

export function setStoredFeatureFlagOverride(flag: FeatureFlag, enabled: boolean) {
  const current = getStoredFeatureFlagOverrides();
  writeStoredFeatureFlagOverride({ ...current, [flag]: enabled });
}

export function setStoredFeatureFlagOverrides(overrides: FeatureFlagOverride) {
  writeStoredFeatureFlagOverride(overrides);
}

export function clearStoredFeatureFlagOverrides() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY);
}

export function resolveAppConfig(params?: {
  env?: EnvSource;
  runtimeOverride?: RuntimeConfigOverride;
  origin?: string;
}): AppConfig {
  const env = params?.env ?? (import.meta.env as unknown as EnvSource);
  const runtimeOverride = params?.runtimeOverride;
  const storedFeatureFlags = params?.env ? undefined : readStoredFeatureFlagOverride();
  const origin =
    params?.origin ??
    (typeof window === "undefined" ? "" : window.location.origin);

  const environment = resolveEnvironment(env);
  const isProd = environment === "production";

  const supabaseUrl = asString(env.VITE_SUPABASE_URL) ?? null;
  const supabaseAnonKey = asString(env.VITE_SUPABASE_ANON_KEY) ?? null;

  const publicModeFromEnv = parseBoolean(env.VITE_PUBLIC_MODE, false);
  const publicMode =
    typeof runtimeOverride?.publicMode === "boolean"
      ? runtimeOverride.publicMode
      : publicModeFromEnv;

  const runtimeRoles = runtimeOverride?.devGate?.allowedRoles;
  const runtimeEmails = runtimeOverride?.devGate?.allowedEmails;
  const allowedRoles = Array.isArray(runtimeRoles)
    ? [...runtimeRoles]
    : parseList(env.VITE_PWA_DEV_ROLES, ["dev"]);
  const allowedEmails = Array.isArray(runtimeEmails)
    ? [...runtimeEmails]
    : parseList(env.VITE_PWA_DEV_EMAILS);

  const serverAccessFunction =
    asString(runtimeOverride?.devGate?.serverAccessFunction) ??
    asString(env.VITE_DEV_ACCESS_FUNCTION) ??
    DEFAULT_DEV_ACCESS_FUNCTION;

  const sessionCacheTtlMs = parseNumber(
    runtimeOverride?.devGate?.sessionCacheTtlMs ?? env.VITE_DEV_SESSION_TTL_MS,
    30 * 60 * 1000
  );
  const staleCacheGraceMs = parseNumber(
    runtimeOverride?.devGate?.staleCacheGraceMs ?? env.VITE_DEV_SESSION_STALE_GRACE_MS,
    5 * 60 * 1000
  );

  return {
    environment,
    isProd,
    publicMode,
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      configured: Boolean(supabaseUrl && supabaseAnonKey),
    },
    devGate: {
      allowedRoles,
      allowedEmails,
      serverAccessFunction,
      sessionCacheTtlMs,
      staleCacheGraceMs,
    },
    controlPlane: {
      baseUrl: resolveControlPlaneBase(env, origin, runtimeOverride?.controlPlaneBaseUrl),
    },
    serviceWorker: {
      devMode: resolveServiceWorkerDevMode(env, runtimeOverride?.serviceWorker?.devMode),
      devCleanupRegistrations:
        typeof runtimeOverride?.serviceWorker?.devCleanupRegistrations === "boolean"
          ? runtimeOverride.serviceWorker.devCleanupRegistrations
          : parseBoolean(env.VITE_SW_DEV_CLEANUP, true),
    },
    featureFlags: resolveFeatureFlags(env, runtimeOverride?.featureFlags, storedFeatureFlags),
  };
}

export function getConfigWarnings(config: AppConfig = appConfig): string[] {
  const warnings: string[] = [];

  if (!config.supabase.configured) {
    warnings.push("Supabase non configurato: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }

  if (!config.publicMode && !config.devGate.allowedRoles.length && !config.devGate.allowedEmails.length) {
    warnings.push("Dev gate senza ruoli/email: nessun account puo accedere alle pagine riservate.");
  }

  if (!config.controlPlane.baseUrl) {
    warnings.push("Control-plane base URL non impostato: verranno usati path relativi.");
  }

  return warnings;
}

export const appConfig = resolveAppConfig({
  runtimeOverride: readRuntimeOverride(),
});
