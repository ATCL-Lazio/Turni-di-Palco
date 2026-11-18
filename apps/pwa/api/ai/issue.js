import { rateLimit, requireUser } from './_guard.js';

const ALLOWED_LABELS = new Set(['supporto', 'Maxwell', 'bug']);
const MAX_TITLE_CHARS = 200;
const MAX_BODY_CHARS = 8000;
const ISSUE_LIMIT_PER_HOUR = 5;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const GITHUB_REPO =
  process.env.AI_SUPPORT_GH_REPO ?? 'ATCL-Lazio/Turni-di-Palco';
const MAXWELL_ISSUE_URL = process.env.MAXWELL_ISSUE_ENDPOINT;

const UPSTREAM_TIMEOUT_MS = 22000;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  if (!rateLimit(`issue:${user.id}`, ISSUE_LIMIT_PER_HOUR, 3_600_000)) {
    res.status(429).json({ ok: false, error: 'Troppe segnalazioni, riprova piu tardi' });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const raw = req.body ?? {};
    const title = typeof raw.title === 'string' ? raw.title.slice(0, MAX_TITLE_CHARS) : '';
    const body = typeof raw.body === 'string' ? raw.body.slice(0, MAX_BODY_CHARS) : '';
    const requestedLabels = Array.isArray(raw.labels)
      ? raw.labels.filter((l) => typeof l === 'string' && ALLOWED_LABELS.has(l))
      : [];
    const labels = requestedLabels.length ? requestedLabels : ['supporto', 'Maxwell'];

    // Se GITHUB_TOKEN è configurato, apri la issue direttamente tramite la GitHub REST API
    if (GITHUB_TOKEN) {
      const ghRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Turni-di-Palco-Support',
          },
          body: JSON.stringify({
            title: title || 'Segnalazione supporto Turni di Palco',
            body: body || '',
            labels,
          }),
          signal: controller.signal,
        },
      );

      const ghData = await ghRes.json();
      if (!ghRes.ok) {
        res.status(ghRes.status).json({
          ok: false,
          error: ghData.message || 'GitHub issue creation failed',
        });
        return;
      }

      res.status(201).json({
        ok: true,
        url: ghData.html_url,
        number: ghData.number,
      });
      return;
    }

    // Se MAXWELL_ISSUE_ENDPOINT è impostato, usa il proxy legacy
    if (MAXWELL_ISSUE_URL) {
      const upstream = await fetch(MAXWELL_ISSUE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });

      const payload = await upstream.text();
      res
        .status(upstream.status)
        .setHeader(
          'Content-Type',
          upstream.headers.get('content-type') || 'application/json',
        )
        .send(payload);
      return;
    }

    // In assenza di token locale, Maxwell su Claude Platform apre le issue in autonomia via MCP
    res.status(200).json({
      ok: true,
      message:
        'Segnalazione registrata. Le issue vengono gestite direttamente da Maxwell via Claude Platform.',
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      res.status(504).json({ ok: false, error: 'Request timeout' });
    } else {
      res.status(502).json({
        ok: false,
        error: 'Issue creation error',
      });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
