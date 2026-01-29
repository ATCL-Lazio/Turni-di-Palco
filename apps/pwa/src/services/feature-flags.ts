export type FeatureFlag = "status-card" | "permissions-card" | "ai-support";

type FeatureFlagConfig = Record<FeatureFlag, boolean>;

const DEFAULT_FLAGS: FeatureFlagConfig = {
  "status-card": true,
  "permissions-card": true,
  "ai-support": false,
};

function parseList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveFeatureFlags(): FeatureFlagConfig {
  const enabled = new Set(parseList(import.meta.env.VITE_FEATURE_FLAGS));
  const disabled = new Set(parseList(import.meta.env.VITE_DISABLED_FEATURE_FLAGS));
  const resolved: FeatureFlagConfig = { ...DEFAULT_FLAGS };

  (Object.keys(resolved) as FeatureFlag[]).forEach((flag) => {
    if (enabled.has(flag)) resolved[flag] = true;
    if (disabled.has(flag)) resolved[flag] = false;
  });

  return resolved;
}

const resolvedFlags = resolveFeatureFlags();

export function isFeatureEnabled(flag: FeatureFlag) {
  return resolvedFlags[flag];
}

export function listFeatureFlags() {
  return { ...resolvedFlags };
}
