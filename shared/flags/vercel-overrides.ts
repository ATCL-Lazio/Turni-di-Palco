const OVERRIDES_COOKIE_KEY = "vercel-flag-overrides";
const SECURE_SUFFIX = ":secure";

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes")
      return true;
    if (normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no")
      return false;
  }
  return undefined;
}

function readCookieValue(name: string, cookieString: string): string | null {
  if (!cookieString.trim()) return null;
  const prefix = `${name}=`;
  const segments = cookieString.split(";");
  for (const segment of segments) {
    const part = segment.trim();
    if (!part.startsWith(prefix)) continue;
    return part.slice(prefix.length);
  }
  return null;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type RawVercelOverrides = Record<string, unknown>;

export function parseVercelFlagOverridesCookieValue(rawValue: string | null): RawVercelOverrides {
  if (!rawValue) return {};
  const decoded = decodeCookieValue(rawValue);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};

  const values = parsed as Record<string, unknown>;
  const normalized: RawVercelOverrides = {};

  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith("$")) continue;
    if (key.endsWith(SECURE_SUFFIX)) continue;
    const flagKey = key.slice(1).trim();
    if (!flagKey) continue;
    normalized[flagKey] = value;
  }

  return normalized;
}

export function parseVercelFlagOverridesCookieHeader(cookieHeader: string): RawVercelOverrides {
  const rawCookieValue = readCookieValue(OVERRIDES_COOKIE_KEY, cookieHeader);
  return parseVercelFlagOverridesCookieValue(rawCookieValue);
}

export function readVercelFlagOverridesFromDocument(): RawVercelOverrides {
  if (typeof document === "undefined") return {};
  return parseVercelFlagOverridesCookieHeader(document.cookie ?? "");
}

export function pickBooleanOverrides<K extends string>(
  keys: readonly K[],
  source: RawVercelOverrides
): Partial<Record<K, boolean>> {
  const next: Partial<Record<K, boolean>> = {};
  for (const key of keys) {
    const boolValue = parseBoolean(source[key]);
    if (typeof boolValue === "boolean") {
      next[key] = boolValue;
    }
  }
  return next;
}
