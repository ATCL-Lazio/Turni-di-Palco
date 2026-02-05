function stripQuotes(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function readEnvFirst(names, options = {}) {
  const { strip = true } = options;
  for (const name of names) {
    const value = process.env[name];
    if (value === undefined || value === null) continue;
    const normalized = strip ? stripQuotes(value) : String(value);
    if (!normalized) continue;
    return normalized;
  }
  return '';
}

function readEnvBool(names, defaultValue = false) {
  const raw = readEnvFirst(names).toLowerCase();
  if (!raw) return defaultValue;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  return defaultValue;
}

function readEnvNumber(names, defaultValue) {
  const raw = readEnvFirst(names);
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function hasEnv(names) {
  return Boolean(readEnvFirst(names));
}

module.exports = {
  hasEnv,
  readEnvBool,
  readEnvFirst,
  readEnvNumber,
  stripQuotes,
};
