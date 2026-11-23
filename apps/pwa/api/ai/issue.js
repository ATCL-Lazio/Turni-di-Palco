import { issueFingerprint, requireUser, supabaseRpc } from './_guard.js';

const ALLOWED_LABELS = new Set(['supporto', 'Maxwell', 'bug']);
const MIN_TITLE_CHARS = 8;
const MAX_TITLE_CHARS = 200;
const MAX_BODY_CHARS = 8000;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const GITHUB_REPO =
  process.env.AI_SUPPORT_GH_REPO ?? 'ATCL-Lazio/Turni-di-Palco';
const MAXWELL_ISSUE_URL = process.env.MAXWELL_ISSUE_ENDPOINT;

const UPSTREAM_TIMEOUT_MS = 22000;

const ISSUE_FOOTER =
  '\n\n---\n_Segnalazione aperta automaticamente da Maxwell._';

// Maxwell apre le segnalazioni in autonomia (comportamento voluto), ma una issue
// finisce su un repository pubblico, quindi:
//  1. la prenotazione passa da Postgres (ai_issue_reserve), che applica il tetto
//     per utente e quello globale e restituisce la issue esistente se lo stesso
//     problema e' gia' stato segnalato di recente;
//  2. se Postgres non risponde non si apre nulla (fail closed).
export async function createIssueHandler(req, res, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const githubToken = deps.githubToken ?? GITHUB_TOKEN;
  const legacyUrl = deps.legacyUrl ?? MAXWELL_ISSUE_URL;
  const authenticate = deps.requireUser ?? requireUser;

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const raw = req.body ?? {};
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE_CHARS) : '';
  const body = typeof raw.body === 'string' ? raw.body.trim().slice(0, MAX_BODY_CHARS) : '';
  if (title.length < MIN_TITLE_CHARS) {
    res.status(400).json({ ok: false, error: 'Titolo mancante o troppo corto' });
    return;
  }
  const requestedLabels = Array.isArray(raw.labels)
    ? raw.labels.filter((l) => typeof l === 'string' && ALLOWED_LABELS.has(l))
    : [];
  const labels = [...new Set([...requestedLabels, 'supporto', 'Maxwell'])];

  if (!githubToken && !legacyUrl) {
    res.status(503).json({ ok: false, error: 'Segnalazioni non configurate' });
    return;
  }

  let reservation;
  try {
    reservation = await supabaseRpc(
      user,
      'ai_issue_reserve',
      { p_fingerprint: issueFingerprint(title) },
      { fetchImpl },
    );
  } catch (error) {
    console.warn('[ai issue] prenotazione non disponibile:', error.message);
    res.status(503).json({ ok: false, error: 'Segnalazioni momentaneamente non disponibili' });
    return;
  }

  switch (reservation?.status) {
    case 'reserved':
      break;
    case 'duplicate':
      res.status(200).json({
        ok: true,
        existing: true,
        url: reservation.url ?? null,
        number: reservation.number ?? null,
      });
      return;
    case 'user_limit':
      res.status(429).json({ ok: false, error: 'Hai gia\' inviato diverse segnalazioni oggi, riprova domani' });
      return;
    case 'global_limit':
      res.status(429).json({ ok: false, error: 'Troppe segnalazioni oggi, riprova domani' });
      return;
    default:
      res.status(503).json({ ok: false, error: 'Segnalazioni momentaneamente non disponibili' });
      return;
  }

  const finish = async (number, url) => {
    try {
      await supabaseRpc(
        user,
        'ai_issue_finish',
        { p_id: reservation.id, p_issue_number: number, p_issue_url: url },
        { fetchImpl },
      );
    } catch (error) {
      console.warn('[ai issue] chiusura prenotazione fallita:', error.message);
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    if (githubToken) {
      const ghRes = await fetchImpl(
        `https://api.github.com/repos/${GITHUB_REPO}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Turni-di-Palco-Support',
          },
          body: JSON.stringify({ title, body: body + ISSUE_FOOTER, labels }),
          signal: controller.signal,
        },
      );

      const ghData = await ghRes.json().catch(() => ({}));
      if (!ghRes.ok) {
        await finish(null, null);
        res.status(502).json({ ok: false, error: 'Creazione segnalazione non riuscita' });
        return;
      }

      await finish(ghData.number ?? null, ghData.html_url ?? null);
      res.status(201).json({ ok: true, url: ghData.html_url, number: ghData.number });
      return;
    }

    // Proxy legacy (Render): stessa prenotazione, payload ricostruito lato server.
    const upstream = await fetchImpl(legacyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body: body + ISSUE_FOOTER, labels }),
      signal: controller.signal,
    });
    const payload = await upstream.text();
    let parsed = null;
    try { parsed = JSON.parse(payload); } catch { /* risposta non JSON */ }
    if (upstream.ok && typeof parsed?.url === 'string') {
      await finish(Number(parsed.number) || 0, parsed.url);
    } else if (!upstream.ok) {
      await finish(null, null);
    }
    res
      .status(upstream.status)
      .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      .send(payload);
  } catch (error) {
    await finish(null, null);
    if (error.name === 'AbortError') {
      res.status(504).json({ ok: false, error: 'Request timeout' });
    } else {
      res.status(502).json({ ok: false, error: 'Issue creation error' });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function handler(req, res) {
  return createIssueHandler(req, res);
}
