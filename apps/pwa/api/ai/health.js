const MAXWELL_HEALTH_URL =
  process.env.MAXWELL_HEALTH_ENDPOINT ??
  'https://maxwell-ai-support.onrender.com/health';

const UPSTREAM_TIMEOUT_MS = 5000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

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
}
