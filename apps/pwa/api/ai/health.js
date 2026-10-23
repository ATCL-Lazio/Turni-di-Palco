const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAXWELL_HEALTH_URL = process.env.MAXWELL_HEALTH_ENDPOINT;

const UPSTREAM_TIMEOUT_MS = 5000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  // Se è configurata ANTHROPIC_API_KEY, il backend AI è attivo su Claude Platform
  if (ANTHROPIC_API_KEY) {
    res.status(200).json({ ok: true, provider: 'claude-platform' });
    return;
  }

  // Fallback legacy a Render solo se MAXWELL_HEALTH_ENDPOINT è definito
  if (MAXWELL_HEALTH_URL) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const upstream = await fetch(MAXWELL_HEALTH_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      res.status(upstream.status).json({ ok: upstream.ok });
    } catch {
      res.status(502).json({ ok: false });
    } finally {
      clearTimeout(timeoutId);
    }
    return;
  }

  // Se nessun endpoint specifico è configurato ma siamo sul serverless proxy
  res.status(200).json({ ok: true, provider: 'claude-platform', status: 'ready' });
}
