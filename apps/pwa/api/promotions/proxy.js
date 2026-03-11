const PROMO_PROXY_SOURCES = Object.freeze({
  "atcl-rss": {
    url: "https://www.atcllazio.it/feed/",
    defaultContentType: "application/rss+xml; charset=utf-8",
  },
  "rossellini-rss": {
    url: "https://www.spaziorossellini.it/category/slide-evidenza/feed/",
    defaultContentType: "application/rss+xml; charset=utf-8",
  },
  "atcl-rest": {
    url: "https://www.atcllazio.it/wp-json/wp/v2/posts?categories=421&per_page=6&_fields=title,link,date,excerpt",
    defaultContentType: "application/json; charset=utf-8",
  },
  "rossellini-rest": {
    url: "https://www.spaziorossellini.it/wp-json/wp/v2/posts?categories=21&per_page=6&_fields=title,link,date,excerpt",
    defaultContentType: "application/json; charset=utf-8",
  },
});

const PROMO_PROXY_MAX_AGE_SECONDS = 300;
const PROMO_PROXY_TIMEOUT_MS = 8000;

function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(payload));
}

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  const source = typeof req.query?.source === "string" ? req.query.source.trim() : "";
  const sourceConfig = PROMO_PROXY_SOURCES[source];
  if (!sourceConfig) {
    sendJson(res, 400, {
      ok: false,
      error: "Invalid promo source",
      allowedSources: Object.keys(PROMO_PROXY_SOURCES),
    });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROMO_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(sourceConfig.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "*/*",
        "user-agent": "Turni-di-Palco/1.0 (+https://turni-di-palco.vercel.app)",
      },
    });

    if (!upstream.ok) {
      sendJson(res, 502, {
        ok: false,
        error: "Upstream request failed",
        source,
        upstreamStatus: upstream.status,
      });
      return;
    }

    const payload = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type") || sourceConfig.defaultContentType;

    res.status(200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", `public, max-age=${PROMO_PROXY_MAX_AGE_SECONDS}`);
    res.setHeader("X-TDP-Promo-Source", source);
    res.send(payload);
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: "Promo proxy unavailable",
      source,
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
