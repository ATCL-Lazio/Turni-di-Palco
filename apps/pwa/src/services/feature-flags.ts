import { appConfig, type FeatureFlag } from "./app-config";

const resolvedFlags = appConfig.featureFlags;

export type { FeatureFlag };

export function isFeatureEnabled(flag: FeatureFlag) {
  return resolvedFlags[flag];
}

export function listFeatureFlags() {
  return { ...resolvedFlags };
}
