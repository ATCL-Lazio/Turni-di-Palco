// Guard condiviso per gli endpoint /api/ai/*: autenticazione Supabase, rate limit
// best-effort in memoria (per istanza serverless) e helper di validazione.
// Il prefisso "_" evita che Vercel lo esponga come route.

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

const buckets = new Map();

export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

// Verifica il JWT Supabase del chiamante. Ritorna { id } oppure risponde 401/503
// e ritorna null (fail closed se Supabase non e' configurato).
export async function requireUser(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(503).json({ ok: false, error: 'Auth non configurata' });
    return null;
  }
  const header = req.headers?.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ ok: false, error: 'Autenticazione richiesta' });
    return null;
  }
  try {
    const upstream = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${match[1]}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) {
      res.status(401).json({ ok: false, error: 'Token non valido' });
      return null;
    }
    const user = await upstream.json();
    if (!user?.id) {
      res.status(401).json({ ok: false, error: 'Token non valido' });
      return null;
    }
    return { id: String(user.id) };
  } catch {
    res.status(503).json({ ok: false, error: 'Auth non raggiungibile' });
    return null;
  }
}
