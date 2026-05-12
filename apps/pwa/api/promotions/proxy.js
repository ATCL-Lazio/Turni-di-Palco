const PROMO_PROXY_SOURCES = Object.freeze({
  'atcl-rss': {
    url: 'https://www.atcllazio.it/feed/',
    defaultContentType: 'application/rss+xml; charset=utf-8',
  },
  'rossellini-rss': {
    url: 'https://www.spaziorossellini.it/category/slide-evidenza/feed/',
    defaultContentType: 'application/rss+xml; charset=utf-8',
  },
  'atcl-rest': {
    url: 'https://www.atcllazio.it/wp-json/wp/v2/posts?categories=421&per_page=6&_fields=title,link,date,excerpt',
    defaultContentType: 'application/json; charset=utf-8',
  },
  'rossellini-rest': {
    url: 'https://www.spaziorossellini.it/wp-json/wp/v2/posts?categories=21&per_page=6&_fields=title,link,date,excerpt',
    defaultContentType: 'application/json; charset=utf-8',
  },
});

const PROMO_PROXY_MAX_AGE_SECONDS = 300;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Set CORS headers on all responses
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const { source } = req.query;
  const sourceKey = (source || '').trim();
  const sourceConfig = PROMO_PROXY_SOURCES[sourceKey];

  if (!sourceConfig) {
    res.status(400).json({
      ok: false,
      error: 'Invalid promo source',
      allowedSources: Object.keys(PROMO_PROXY_SOURCES),
    });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(sourceConfig.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Turni-di-Palco/1.0 (+https://turni-di-palco.vercel.app)',
        accept: '*/*',
      },
    });

    if (!upstream.ok) {
      res.status(502).json({
        ok: false,
        error: 'Upstream request failed',
        source: sourceKey,
        upstreamStatus: upstream.status,
      });
      return;
    }

    const payload = await upstream.arrayBuffer();
    const contentType =
      upstream.headers.get('content-type') || sourceConfig.defaultContentType;

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Cache-Control',
      `public, max-age=${PROMO_PROXY_MAX_AGE_SECONDS}`
    );
    res.setHeader('X-TDP-Promo-Source', sourceKey);
    res.status(200).send(Buffer.from(payload));
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: 'Promo proxy unavailable',
      source: sourceKey,
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
