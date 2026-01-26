type UserMetadata = Record<string, unknown> | null | undefined;

function normalizeString(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length ? trimmed : '';
}

function extractNameFromMetadata(metadata: UserMetadata) {
  if (!metadata || typeof metadata !== 'object') return '';
  return (
    normalizeString(metadata.name) ||
    normalizeString(metadata.full_name) ||
    normalizeString(metadata.preferred_username) ||
    normalizeString(metadata.user_name) ||
    normalizeString(metadata.username)
  );
}

function extractNameFromEmail(email: unknown) {
  const emailValue = normalizeString(email);
  if (!emailValue) return '';
  const [prefix] = emailValue.split('@');
  return normalizeString(prefix);
}

export function resolveDisplayName({
  name,
  email,
  metadata,
  fallback = 'Utente',
}: {
  name?: unknown;
  email?: unknown;
  metadata?: UserMetadata;
  fallback?: string;
}) {
  return (
    normalizeString(name) ||
    extractNameFromMetadata(metadata) ||
    extractNameFromEmail(email) ||
    normalizeString(fallback) ||
    'Utente'
  );
}
