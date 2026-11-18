// Allowlist for outbound links coming from external promo feeds (closes part of #1683).
// Only https URLs on the known ATCL / Spazio Rossellini hosts are ever opened.
const ALLOWED_PROMO_HOSTS = ['atcllazio.it', 'spaziorossellini.it'] as const;

export function sanitizePromoUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:') return undefined;
  if (parsed.username || parsed.password) return undefined;
  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_PROMO_HOSTS.some(
    (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`)
  );
  return allowed ? parsed.toString() : undefined;
}
