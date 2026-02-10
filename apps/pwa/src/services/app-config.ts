export type FeatureFlag = "status-card" | "permissions-card" | "ai-support";
export type ServiceWorkerDevMode = "cleanup" | "register";
export type RuntimeEnvironment = "development" | "production" | "test";

export type FeatureFlagConfig = Record<FeatureFlag, boolean>;

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

const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  "status-card": true,
  "permissions-card": true,
  "ai-support": false,
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
  runtimeOverride?: Partial<FeatureFlagConfig>
): FeatureFlagConfig {
  const enabled = new Set(parseList(env.VITE_FEATURE_FLAGS));
  const disabled = new Set(parseList(env.VITE_DISABLED_FEATURE_FLAGS));
  const resolved: FeatureFlagConfig = { ...DEFAULT_FEATURE_FLAGS };

  FEATURE_FLAG_KEYS.forEach((flag) => {
    if (enabled.has(flag)) resolved[flag] = true;
    if (disabled.has(flag)) resolved[flag] = false;
  });

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

export function resolveAppConfig(params?: {
  env?: EnvSource;
  runtimeOverride?: RuntimeConfigOverride;
  origin?: string;
}): AppConfig {
  const env = params?.env ?? (import.meta.env as unknown as EnvSource);
  const runtimeOverride = params?.runtimeOverride;
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
    featureFlags: resolveFeatureFlags(env, runtimeOverride?.featureFlags),
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
