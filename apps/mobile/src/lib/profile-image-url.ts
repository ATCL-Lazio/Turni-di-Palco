// Client-side guard for profiles.profile_image (#1684). The server enforces the same
// rule with a trigger; this keeps arbitrary third-party URLs out of <img> tags and
// out of upserts. Accepted: this project's public `profile-images` object URL.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH_RE = new RegExp(`^/storage/v1/object/public/profile-images/(${UUID})/profile\\.(jpg|png|webp|gif)$`, 'i');

function projectOrigin(supabaseUrl: unknown): string | null {
  if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) return null;
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function sanitizeProfileImageUrl(
  value: unknown,
  ownerId?: string,
  supabaseUrl: unknown = import.meta.env.VITE_SUPABASE_URL,
): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const origin = projectOrigin(supabaseUrl);
  if (!origin) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (parsed.origin !== origin || parsed.username || parsed.password || parsed.hash) return undefined;
  const match = PATH_RE.exec(parsed.pathname);
  if (!match) return undefined;
  if (ownerId && match[1].toLowerCase() !== ownerId.toLowerCase()) return undefined;
  // Only the cache-busting `v` query parameter written by uploadProfileImage is allowed.
  for (const [key, val] of parsed.searchParams) {
    if (key !== 'v' || !/^\d+$/.test(val)) return undefined;
  }
  return parsed.toString();
}
