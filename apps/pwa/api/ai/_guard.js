// Guard condiviso per gli endpoint /api/ai/*: autenticazione Supabase, rate limit
// persistente su Postgres (RPC di supabase/migrations/20261123100000_ai_support_guards.sql)
// e helper per le chiamate RPC fatte con il JWT dell'utente.
// Il prefisso "_" evita che Vercel lo esponga come route.

import { createHash } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

const RPC_TIMEOUT_MS = 4000;

// Primo filtro economico, per istanza. Non e' affidabile su serverless (ogni
// istanza ha la sua memoria), per questo il limite vero sta su Postgres.
const buckets = new Map();

export function rateLimit(key, max, windowMs, now = Date.now()) {
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

export function _resetMemoryRateLimit() {
  buckets.clear();
}

// Chiama una funzione Postgres via PostgREST con il JWT dell'utente, cosi' le
// RPC vedono auth.uid() e toccano solo le righe dell'utente stesso.
export async function supabaseRpc(user, fn, args, { fetchImpl = fetch } = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase non configurato');
  }
  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args ?? {}),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`RPC ${fn} fallita: ${res.status} ${detail.slice(0, 200)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Rate limit persistente. Ritorna true (consentito), false (oltre il limite).
// Se Postgres non risponde: con failOpen ricade sul limite in memoria e lo
// segnala nei log, altrimenti ritorna null e il chiamante risponde 503.
export async function persistentRateLimit(
  user,
  { scope, max, windowSeconds, failOpen = false },
  deps = {},
) {
  if (!rateLimit(`${scope}:${user.id}`, max, windowSeconds * 1000)) return false;
  try {
    const hits = await supabaseRpc(
      user,
      'ai_rate_limit_hit',
      { p_scope: scope, p_window_seconds: windowSeconds },
      deps,
    );
    return Number(hits) <= max;
  } catch (error) {
    console.warn(`[ai guard] rate limit persistente non disponibile (${scope}):`, error.message);
    return failOpen ? true : null;
  }
}

// Impronta per la deduplica delle segnalazioni: titolo normalizzato (minuscole,
// senza accenti, punteggiatura e spazi multipli), sha256 in esadecimale.
export function issueFingerprint(title) {
  const normalized = String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return createHash('sha256').update(normalized).digest('hex');
}

// Verifica il JWT Supabase del chiamante. Ritorna { id, token } oppure risponde
// 401/503 e ritorna null (fail closed se Supabase non e' configurato).
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
    return { id: String(user.id), token: match[1] };
  } catch {
    res.status(503).json({ ok: false, error: 'Auth non raggiungibile' });
    return null;
  }
}
