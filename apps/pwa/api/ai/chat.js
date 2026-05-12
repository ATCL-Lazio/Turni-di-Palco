const MAXWELL_CHAT_URL =
  process.env.MAXWELL_ENDPOINT ??
  'https://maxwell-ai-support.onrender.com/api/ai/chat';

const UPSTREAM_TIMEOUT_MS = 15000;

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
    const upstream = await fetch(MAXWELL_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    const payload = await upstream.text();
    res
      .status(upstream.status)
      .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      .send(payload);
  } catch (error) {
    if (error.name === 'AbortError') {
      res.status(504).json({ ok: false, error: 'Maxwell timeout' });
    } else {
      res.status(502).json({ ok: false, error: 'Maxwell unreachable', detail: error.message });
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
