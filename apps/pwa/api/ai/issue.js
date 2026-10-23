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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const { title, body, labels } = req.body ?? {};

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
            labels: Array.isArray(labels) ? labels : ['supporto', 'Maxwell'],
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
        detail: error.message,
      });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
