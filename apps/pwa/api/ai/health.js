const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  // Il backend AI e' Claude Platform: senza chiave configurata non e' disponibile.
  if (ANTHROPIC_API_KEY) {
    res.status(200).json({ ok: true });
    return;
  }

  res.status(503).json({ ok: false });
}
