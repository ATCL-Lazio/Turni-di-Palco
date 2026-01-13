#!/usr/bin/env node
const http = require('node:http');
const https = require('node:https');
const { spawn, spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const port = Number(process.env.AI_SUPPORT_PORT) || 8787;
const host = process.env.AI_SUPPORT_HOST || '127.0.0.1';
const codexBin = resolveCodexBin();
const codexArgs = process.env.CODEX_ARGS ? process.env.CODEX_ARGS.split(' ') : [];
const maxBodySize = 1_000_000;
const verbose =
  process.env.AI_SUPPORT_VERBOSE !== '0' &&
  process.env.AI_SUPPORT_VERBOSE !== 'false';
const logMessages =
  process.env.AI_SUPPORT_LOG_MESSAGES === '1' ||
  process.env.AI_SUPPORT_LOG_MESSAGES === 'true';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function resolveCodexBin() {
  if (process.env.CODEX_BIN) {
    return process.env.CODEX_BIN;
  }

  if (process.platform === 'win32') {
    const whereResult = spawnSync('where.exe', ['codex'], { encoding: 'utf8' });
    if (whereResult.status === 0 && whereResult.stdout) {
      const candidates = whereResult.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const cmdCandidate = candidates.find((line) => line.endsWith('.cmd'));
      if (cmdCandidate) return cmdCandidate;
      const exeCandidate = candidates.find((line) => line.endsWith('.exe'));
      if (exeCandidate) return exeCandidate;
      if (candidates[0]) {
        const base = candidates[0];
        if (fs.existsSync(`${base}.cmd`)) return `${base}.cmd`;
        if (fs.existsSync(`${base}.exe`)) return `${base}.exe`;
        return base;
      }
    }

    const appData = process.env.APPDATA;
    if (appData) {
      const candidate = path.join(appData, 'npm', 'codex.cmd');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return 'codex';
}

function logLine(message) {
  if (!verbose) return;
  const stamp = new Date().toISOString();
  process.stdout.write(`[${stamp}] ${message}\n`);
}

function logError(message) {
  const stamp = new Date().toISOString();
  process.stderr.write(`[${stamp}] ${message}\n`);
}

function parseAllowedOrigins() {
  const raw = process.env.AI_SUPPORT_ALLOWED_ORIGINS;
  if (!raw) return ['*'];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(origin, allowedOrigins) {
  if (!origin) return allowedOrigins.includes('*') ? '*' : '';
  if (allowedOrigins.includes('*')) return '*';
  if (allowedOrigins.includes(origin)) return origin;
  return '';
}

function resolveHttpsOptions() {
  const httpsEnv = process.env.AI_SUPPORT_HTTPS;
  if (httpsEnv === 'false' || httpsEnv === '0') {
    return null;
  }

  const flag = httpsEnv === 'true' || httpsEnv === '1';
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
    const keyFile = fs
      .readdirSync(certRoot)
      .find((name) => name.endsWith('-key.pem'));
    if (keyFile) {
      const keyBase = path.basename(keyFile, '.pem').replace(/-key$/, '');
      const certFile = path.join(certRoot, `${keyBase}.pem`);
      const keyFilePath = path.join(certRoot, keyFile);
      if (fs.existsSync(certFile)) {
        return {
          cert: fs.readFileSync(certFile),
          key: fs.readFileSync(keyFilePath),
        };
      }
    }
  }

  if (flag) {
    throw new Error(
      'AI_SUPPORT_HTTPS is enabled but no certificate was found.'
    );
  }

  return null;
}

function buildPrompt({ prompt, messages, context }) {
  const systemParts = [];
  if (typeof prompt === 'string' && prompt.trim()) {
    systemParts.push(prompt.trim());
  }
  if (context?.userName) {
    systemParts.push(`Nome utente: ${context.userName}`);
  }

  const systemPrompt = systemParts.join('\n\n');
  const history = Array.isArray(messages) ? messages : [];
  const lines = [];
  if (systemPrompt) {
    lines.push(`System: ${systemPrompt}`);
  }

  for (const message of history) {
    if (!message || typeof message.content !== 'string') continue;
    const role = message.role === 'assistant' ? 'Assistant' : 'User';
    if (message.role === 'system') continue;
    lines.push(`${role}: ${message.content}`);
  }

  lines.push('Assistant:');
  return lines.join('\n');
}

function buildTempReplyPath() {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(os.tmpdir(), `codex-reply-${id}.txt`);
}

async function readReplyFile(filePath) {
  const data = await fs.promises.readFile(filePath, 'utf8');
  return data.trim();
}

async function cleanupFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Ignore cleanup errors.
  }
}

function runCodex(prompt) {
  return new Promise((resolve, reject) => {
    const replyPath = buildTempReplyPath();
    const args = [
      'exec',
      ...codexArgs,
      '--output-last-message',
      replyPath,
      '--color',
      'never',
      '-',
    ];
    const child = spawnCodexProcess(args);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        await cleanupFile(replyPath);
        reject(new Error(stderr || `Codex exited with code ${code}`));
        return;
      }
      try {
        const reply = await readReplyFile(replyPath);
        await cleanupFile(replyPath);
        resolve(reply);
      } catch (error) {
        await cleanupFile(replyPath);
        reject(error);
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function spawnCodexProcess(args) {
  if (process.platform === 'win32') {
    const lower = codexBin.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
      return spawn('cmd.exe', ['/c', codexBin, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
  }
  return spawn(codexBin, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

const httpsOptions = resolveHttpsOptions();
const requestHandler = (req, res) => {
  const start = Date.now();
  const requestId = `${start}-${Math.random().toString(16).slice(2, 8)}`;
  const allowedOrigins = parseAllowedOrigins();
  const origin = req.headers.origin;
  const corsOrigin = resolveCorsOrigin(origin, allowedOrigins);

  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    logLine(`${requestId} GET /health 200 ${Date.now() - start}ms`);
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.url !== '/api/ai/chat') {
    logLine(
      `${requestId} ${req.method} ${req.url} 404 ${Date.now() - start}ms`
    );
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (req.method !== 'POST') {
    logLine(
      `${requestId} ${req.method} ${req.url} 405 ${Date.now() - start}ms`
    );
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > maxBodySize) {
      logLine(`${requestId} payload too large (${body.length} bytes)`);
      res.writeHead(413);
      res.end();
      req.destroy();
    }
  });

  req.on('end', async () => {
    logLine(
      `${requestId} POST /api/ai/chat from ${origin ?? 'unknown'} size=${body.length}`
    );
    let payload;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch (error) {
      logError(`${requestId} invalid JSON body`);
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    try {
      const summary = {
        messages: Array.isArray(payload?.messages)
          ? payload.messages.length
          : 0,
        userName: payload?.context?.userName ?? null,
        promptLength:
          typeof payload?.prompt === 'string' ? payload.prompt.length : 0,
      };
      logLine(`${requestId} payload ${JSON.stringify(summary)}`);
      if (logMessages && Array.isArray(payload?.messages)) {
        const preview = payload.messages
          .map((message) => ({
            role: message?.role ?? 'unknown',
            length: typeof message?.content === 'string' ? message.content.length : 0,
          }))
          .slice(0, 10);
        logLine(`${requestId} messages ${JSON.stringify(preview)}`);
      }
      const prompt = buildPrompt(payload ?? {});
      logLine(`${requestId} codex exec start`);
      const codexStart = Date.now();
      const reply = await runCodex(prompt);
      const codexElapsed = Date.now() - codexStart;
      logLine(
        `${requestId} codex exec done ${codexElapsed}ms reply=${reply.length}`
      );
      sendJson(res, 200, { reply });
      logLine(`${requestId} POST /api/ai/chat 200 ${Date.now() - start}ms`);
    } catch (error) {
      logError(
        `${requestId} POST /api/ai/chat 500 ${Date.now() - start}ms ${error.message}`
      );
      sendJson(res, 500, { error: error.message || 'Codex failed' });
    }
  });
};

const server = httpsOptions
  ? https.createServer(httpsOptions, requestHandler)
  : http.createServer(requestHandler);

server.listen(port, host, () => {
  const protocol = httpsOptions ? 'https' : 'http';
  process.stdout.write(
    `AI support server listening on ${protocol}://${host}:${port}\n`
  );
  if (verbose) {
    logLine(`Verbose logging enabled`);
    if (logMessages) {
      logLine(`Message length logging enabled`);
    }
    logLine(`Codex binary: ${codexBin}`);
  }
});
