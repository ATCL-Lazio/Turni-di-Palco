const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { URL } = require('url');

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

function safeJsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function handlePromoProxyRequest(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    safeJsonResponse(res, 405, { ok: false, error: 'Method Not Allowed' });
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const source = (url.searchParams.get('source') || '').trim();
  const sourceConfig = PROMO_PROXY_SOURCES[source];
  if (!sourceConfig) {
    safeJsonResponse(res, 400, {
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
        'user-agent': 'Turni-di-Palco/1.0 (+https://turni-di-palco.onrender.com)',
        accept: '*/*',
      },
    });

    if (!upstream.ok) {
      safeJsonResponse(res, 502, {
        ok: false,
        error: 'Upstream request failed',
        source,
        upstreamStatus: upstream.status,
      });
      return;
    }

    const payload = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || sourceConfig.defaultContentType;

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', `public, max-age=${PROMO_PROXY_MAX_AGE_SECONDS}`);
    res.setHeader('X-TDP-Promo-Source', source);
    res.end(Buffer.from(payload));
  } catch (error) {
    safeJsonResponse(res, 502, {
      ok: false,
      error: 'Promo proxy unavailable',
      source,
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveHttpsOptions() {
  const httpsEnv = process.env.HTTPS;
  if (httpsEnv === 'false' || httpsEnv === '0') return null;

  const certPath = process.env.SSL_CRT_FILE;
  const keyPath = process.env.SSL_KEY_FILE;
  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(path.resolve(certPath)),
      key: fs.readFileSync(path.resolve(keyPath)),
    };
  }

  const repoRoot = path.resolve(__dirname, '..');
  const certRoot = path.join(repoRoot, '.cert');
  if (fs.existsSync(certRoot)) {
    const keyFile = fs.readdirSync(certRoot).find((name) => name.endsWith('-key.pem'));
    if (keyFile) {
      const keyBase = path.basename(keyFile, '.pem').replace(/-key$/, '');
      const certFilePath = path.join(certRoot, `${keyBase}.pem`);
      const keyFilePath = path.join(certRoot, keyFile);
      if (fs.existsSync(certFilePath)) {
        return {
          cert: fs.readFileSync(certFilePath),
          key: fs.readFileSync(keyFilePath),
        };
      }
    }
  }

  return null;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.webmanifest':
      return 'application/manifest+json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    case '.webp':
      return 'image/webp';
    case '.woff2':
      return 'font/woff2';
    case '.woff':
      return 'font/woff';
    case '.ttf':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
}

function listNetworkUrls(protocol, port) {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface || []) {
      if (addr && addr.family === 'IPv4' && !addr.internal) {
        urls.push(`${protocol}://${addr.address}:${port}/`);
      }
    }
  }
  return urls;
}

function resolveRequestPath(distDir, urlPath) {
  const safePath = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/');
  const cleaned = safePath.startsWith('/') ? safePath.slice(1) : safePath;

  const candidates = [];
  if (cleaned === '') {
    candidates.push('index.html');
  } else if (cleaned.endsWith('/')) {
    candidates.push(`${cleaned}index.html`);
  } else {
    candidates.push(cleaned);
    if (!path.extname(cleaned)) {
      candidates.push(`${cleaned}.html`);
      candidates.push(`${cleaned}/index.html`);
    }
  }

  for (const rel of candidates) {
    const abs = path.join(distDir, rel);
    if (abs.startsWith(distDir) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return abs;
    }
  }

  return null;
}

function resolveMobileRequestPath(distDir, urlPath) {
  const mobileRoot = path.join(distDir, 'public', 'mobile');
  const safePath = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/');
  if (safePath === '/mobile' || safePath === '/mobile/') {
    return resolveRequestPath(mobileRoot, '/');
  }

  if (!safePath.startsWith('/mobile/')) {
    return null;
  }

  const withoutPrefix = safePath.slice('/mobile'.length);
  return resolveRequestPath(mobileRoot, withoutPrefix || '/');
}

function hasHashedFilename(filePath) {
  const file = path.basename(filePath);
  return /-[a-f0-9]{8,}\./i.test(file);
}

function resolveCacheControl(distDir, filePath) {
  const relPath = path.relative(distDir, filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.html' || ext === '.webmanifest') {
    return 'no-store';
  }

  if (relPath.endsWith('/sw.js') || relPath === 'sw.js') {
    return 'no-store';
  }

  if (relPath.startsWith('assets/') && hasHashedFilename(relPath)) {
    return 'public, max-age=31536000, immutable';
  }

  if (relPath.includes('/icons/') || relPath.includes('/qrcodes/')) {
    return 'public, max-age=31536000, immutable';
  }

  return 'no-cache';
}

function createHandler(distDir) {
  return (req, res) => {
    const requestUrl = req.url || '/';
    const parsedPath = (() => {
      try {
        return new URL(requestUrl, 'http://localhost').pathname;
      } catch {
        return '/';
      }
    })();

    if (parsedPath === '/api/promotions/proxy' || parsedPath === '/mobile/api/promotions/proxy') {
      void handlePromoProxyRequest(req, res);
      return;
    }

    // Health check endpoint per keep-alive incrociato
    if (req.url === '/health' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ok',
        service: 'turni-di-palco',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }));
      return;
    }

    if (!req.url || req.method !== 'GET') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    const mobileFilePath = resolveMobileRequestPath(distDir, req.url);
    const filePath = mobileFilePath || resolveRequestPath(distDir, req.url);
    if (!filePath) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', getMimeType(filePath));
    res.setHeader('Cache-Control', resolveCacheControl(distDir, filePath));

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  };
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const distDir = path.resolve(repoRoot, 'apps', 'pwa', 'dist');

  if (!fs.existsSync(distDir)) {
    console.error(`Missing dist directory: ${distDir}`);
    process.exit(1);
  }

  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '0.0.0.0';
  const httpsOptions = resolveHttpsOptions();
  const server = httpsOptions
    ? https.createServer(httpsOptions, createHandler(distDir))
    : http.createServer(createHandler(distDir));

  server.listen(port, host, () => {
    const protocol = httpsOptions ? 'https' : 'http';
    console.log(`  ➜  Local:   ${protocol}://localhost:${port}/`);
    for (const url of listNetworkUrls(protocol, port)) {
      console.log(`  ➜  Network: ${url}`);
    }
  });
}

main();

