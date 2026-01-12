const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

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

function createHandler(distDir) {
  return (req, res) => {
    if (!req.url || req.method !== 'GET') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    const filePath = resolveRequestPath(distDir, req.url);
    if (!filePath) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', getMimeType(filePath));
    res.setHeader('Cache-Control', 'no-cache');

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

