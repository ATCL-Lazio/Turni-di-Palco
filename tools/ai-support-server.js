#!/usr/bin/env node
const http = require('node:http');
const https = require('node:https');
const { spawn, spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const port =
  Number(process.env.PORT) ||
  Number(process.env.AI_SUPPORT_PORT || process.env.VITE_AI_SUPPORT_PORT) ||
  8787;
const host = resolveHost();
const codexBin = resolveCodexBin();
const ghBin = resolveGhBin();
const codexArgs = process.env.CODEX_ARGS ? process.env.CODEX_ARGS.split(' ') : [];
const maxBodySize = 1_000_000;
const verbose =
  process.env.AI_SUPPORT_VERBOSE !== '0' &&
  process.env.AI_SUPPORT_VERBOSE !== 'false';
const logMessages =
  process.env.AI_SUPPORT_LOG_MESSAGES === '1' ||
  process.env.AI_SUPPORT_LOG_MESSAGES === 'true';
const enableColor =
  process.env.AI_SUPPORT_COLOR !== '0' &&
  process.env.AI_SUPPORT_COLOR !== 'false' &&
  process.stdout.isTTY;
const authStorage = resolveAuthStorage();

function isTruthy(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function stripEnvValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

function readEnvFileValue(filePath, key) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith(`${key}=`)) continue;
    const value = trimmed.slice(key.length + 1);
    const cleaned = stripEnvValue(value);
    return cleaned || null;
  }
  return null;
}

function writeEnvFileValue(filePath, key, value) {
  if (!filePath || !key) return false;
  const output = `${key}=${JSON.stringify(String(value))}`;
  const exists = fs.existsSync(filePath);
  const lines = exists ? fs.readFileSync(filePath, 'utf8').split(/\r?\n/) : [];
  let updated = false;
  const nextLines = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      updated = true;
      return output;
    }
    return line;
  });
  if (!updated) {
    if (nextLines.length && nextLines[nextLines.length - 1] !== '') {
      nextLines.push('');
    }
    nextLines.push(output);
  }
  fs.writeFileSync(filePath, nextLines.join('\n'), 'utf8');
  return true;
}

function resolveAuthStorage() {
  const envFilePath = process.env.AI_SUPPORT_AUTH_ENV_FILE
    ? path.resolve(process.env.AI_SUPPORT_AUTH_ENV_FILE)
    : null;
  const writeEnvFile = isTruthy(process.env.AI_SUPPORT_AUTH_ENV_WRITE);
  let authDir = process.env.AI_SUPPORT_AUTH_DIR || null;
  let source = authDir ? 'env' : null;
  let envFileStatus = envFilePath ? 'missing' : 'disabled';

  if (!authDir && envFilePath) {
    const value = readEnvFileValue(envFilePath, 'AI_SUPPORT_AUTH_DIR');
    if (value) {
      authDir = value;
      source = 'env-file';
      envFileStatus = 'loaded';
    } else if (fs.existsSync(envFilePath)) {
      envFileStatus = 'missing-auth-dir';
    }
  }

  if (!authDir) {
    return {
      enabled: false,
      authDir: null,
      source: null,
      codexDir: null,
      githubDir: null,
      envFile: envFilePath,
      envFileStatus,
      envFileWriteEnabled: writeEnvFile,
    };
  }

  const resolvedAuthDir = path.resolve(authDir);
  const codexDir = path.join(resolvedAuthDir, 'codex');
  const githubDir = path.join(resolvedAuthDir, 'github');
  fs.mkdirSync(codexDir, { recursive: true });
  fs.mkdirSync(githubDir, { recursive: true });

  if (envFilePath) {
    if (writeEnvFile) {
      writeEnvFileValue(envFilePath, 'AI_SUPPORT_AUTH_DIR', resolvedAuthDir);
      envFileStatus = fs.existsSync(envFilePath) ? 'written' : 'missing';
    } else if (fs.existsSync(envFilePath)) {
      envFileStatus = envFileStatus === 'loaded' ? 'loaded' : 'available';
    }
  }

  return {
    enabled: true,
    authDir: resolvedAuthDir,
    source,
    codexDir,
    githubDir,
    envFile: envFilePath,
    envFileStatus,
    envFileWriteEnabled: writeEnvFile,
  };
}

function buildCodexEnv() {
  if (!authStorage?.enabled) return null;
  return {
    ...process.env,
    XDG_CONFIG_HOME: authStorage.codexDir,
    XDG_STATE_HOME: authStorage.codexDir,
    XDG_DATA_HOME: authStorage.codexDir,
  };
}

function buildGhEnv() {
  if (!authStorage?.enabled) return null;
  return {
    ...process.env,
    GH_CONFIG_DIR: authStorage.githubDir,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
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

function resolveGhBin() {
  if (process.env.AI_SUPPORT_GH_BIN) {
    return process.env.AI_SUPPORT_GH_BIN;
  }

  if (process.platform === 'win32') {
    const whereResult = spawnSync('where.exe', ['gh'], { encoding: 'utf8' });
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
      const candidate = path.join(appData, 'npm', 'gh.cmd');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return 'gh';
}

function resolveGithubRepo() {
  if (process.env.AI_SUPPORT_GH_REPO) {
    return process.env.AI_SUPPORT_GH_REPO;
  }
  if (process.env.GITHUB_REPO) {
    return process.env.GITHUB_REPO;
  }
  if (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME) {
    return `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`;
  }
  return null;
}

let codexLoginProcess = null;
let ghLoginProcess = null;

function spawnCodexSync(args) {
  const env = buildCodexEnv();
  if (process.platform === 'win32') {
    const lower = codexBin.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
      return spawnSync('cmd.exe', ['/c', codexBin, ...args], {
        encoding: 'utf8',
        env: env ?? process.env,
      });
    }
  }
  return spawnSync(codexBin, args, { encoding: 'utf8', env: env ?? process.env });
}

function spawnGhSync(args) {
  const env = buildGhEnv();
  if (process.platform === 'win32') {
    const lower = ghBin.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
      return spawnSync('cmd.exe', ['/c', ghBin, ...args], {
        encoding: 'utf8',
        env: env ?? process.env,
      });
    }
  }
  return spawnSync(ghBin, args, { encoding: 'utf8', env: env ?? process.env });
}

function spawnCodexLoginProcess(args) {
  const env = buildCodexEnv();
  if (process.platform === 'win32') {
    const lower = codexBin.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
      return spawn('cmd.exe', ['/c', codexBin, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env ?? process.env,
      });
    }
  }
  return spawn(codexBin, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: env ?? process.env,
  });
}

function spawnGhLoginProcess(args) {
  const env = buildGhEnv();
  if (process.platform === 'win32') {
    const lower = ghBin.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
      return spawn('cmd.exe', ['/c', ghBin, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env ?? process.env,
      });
    }
  }
  return spawn(ghBin, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: env ?? process.env,
  });
}

function readCliOutput(result) {
  const stdout = result?.stdout ? String(result.stdout) : '';
  const stderr = result?.stderr ? String(result.stderr) : '';
  return [stdout, stderr].filter(Boolean).join('\n').trim();
}

const loginUrlRegex = /https?:\/\/[^\s"']+/i;
const loginCodeRegex = /\b[A-Z0-9]{4}-[A-Z0-9]{4}\b|\b[A-Z0-9]{8}\b|\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/;

function logAuthEvent(message) {
  const stamp = new Date().toISOString();
  process.stdout.write(`[${stamp}] ${message}\n`);
}

function parseLoginOutput(text, state, label) {
  if (!text) return;
  
  // Log the raw output for debugging
  logAuthEvent(`${label} raw output: "${text}"`);
  
  const urlMatch = text.match(loginUrlRegex);
  if (urlMatch && !state.url) {
    state.url = urlMatch[0];
    logAuthEvent(`${label} login URL: ${state.url}`);
  }
  const codeMatch = text.match(loginCodeRegex);
  if (codeMatch && !state.code) {
    state.code = codeMatch[0];
    logAuthEvent(`${label} login code: ${state.code}`);
  }
}

function trackLoginProcess({ label, child, onDone }) {
  const state = { url: null, code: null };
  let resolved = false;

  return new Promise((resolve) => {
    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      resolve(payload);
    };

    const handleChunk = (chunk) => {
      const text = chunk.toString();
      parseLoginOutput(text, state, label);
      if (state.url && !resolved) {
        // Don't resolve immediately - wait a bit to see if we also get a code
        setTimeout(() => {
          if (!resolved) {
            finish({ started: true, url: state.url, code: state.code, pid: child.pid });
          }
        }, 500);
      }
    };

    if (child.stdout) {
      child.stdout.on('data', handleChunk);
    }
    if (child.stderr) {
      child.stderr.on('data', handleChunk);
    }

    child.on('error', (error) => {
      logAuthEvent(`${label} login error: ${error.message}`);
      onDone();
      finish({ started: false, reason: error.message });
    });

    child.on('close', (code) => {
      logAuthEvent(`${label} login exited (${code ?? 'unknown'})`);
      onDone();
      if (!resolved) {
        finish({
          started: code === 0,
          url: state.url,
          code: state.code,
          reason: code === 0 ? null : `exit ${code}`,
        });
      }
    });

  });
}

function startCodexLogin() {
  if (codexLoginProcess) {
    return Promise.resolve({ started: false, reason: 'Codex login already running.' });
  }
  const child = spawnCodexLoginProcess(['login', '--device-auth']);
  codexLoginProcess = child;
  return trackLoginProcess({
    label: 'Codex',
    child,
    onDone: () => {
      codexLoginProcess = null;
    },
  });
}

function startGhLogin() {
  if (ghLoginProcess) {
    return Promise.resolve({ started: false, reason: 'GitHub login already running.' });
  }
  const child = spawnGhLoginProcess(['auth', 'login', '--device']);
  ghLoginProcess = child;
  return trackLoginProcess({
    label: 'GitHub',
    child,
    onDone: () => {
      ghLoginProcess = null;
    },
  });
}

function checkCodexAuth() {
  const result = spawnCodexSync(['login', 'status']);
  if (result?.error) {
    return {
      hasApiKey: false,
      apiKeyLength: 0,
      codexBin,
      source: 'cli',
      sourceLabel: 'Codex CLI',
      status: 'unavailable',
      detail: result.error.message,
    };
  }

  const output = readCliOutput(result);
  const normalized = output.toLowerCase();
  const loggedIn =
    result.status === 0 &&
    normalized.includes('logged in') &&
    !normalized.includes('not logged');
  return {
    hasApiKey: loggedIn,
    apiKeyLength: 0,
    codexBin,
    source: 'cli',
    sourceLabel: 'Codex CLI',
    status: loggedIn ? 'authenticated' : 'unauthenticated',
    detail: output || null,
  };
}

function checkGhAuth() {
  const result = spawnGhSync(['auth', 'status']);
  if (result?.error) {
    return {
      hasToken: false,
      tokenLength: 0,
      ghBin,
      source: 'cli',
      sourceLabel: 'GitHub CLI',
      status: 'unavailable',
      detail: result.error.message,
    };
  }

  const output = readCliOutput(result);
  const normalized = output.toLowerCase();
  const loggedIn =
    result.status === 0 &&
    normalized.includes('logged in') &&
    !normalized.includes('not logged');
  return {
    hasToken: loggedIn,
    tokenLength: 0,
    ghBin,
    source: 'cli',
    sourceLabel: 'GitHub CLI',
    status: loggedIn ? 'authenticated' : 'unauthenticated',
    detail: output || null,
  };
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

function colorize(text, code) {
  if (!enableColor) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

function formatStatus(status) {
  if (!Number.isFinite(status)) return String(status);
  if (status >= 500) return colorize(String(status), 31);
  if (status >= 400) return colorize(String(status), 33);
  if (status >= 300) return colorize(String(status), 36);
  if (status >= 200) return colorize(String(status), 32);
  return colorize(String(status), 35);
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

function resolveHost() {
  if (process.env.AI_SUPPORT_HOST) {
    return process.env.AI_SUPPORT_HOST;
  }
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
    return '0.0.0.0';
  }
  return '127.0.0.1';
}

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry && entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

function buildDashboardHtml({ protocol }) {
  const now = new Date();
  const codexAuth = checkCodexAuth();
  const ghAuth = checkGhAuth();
  const data = {
    startedAt: new Date(Date.now() - Math.round(process.uptime() * 1000)),
    now,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus()?.length ?? 0,
    loadavg: os.loadavg?.() ?? [0, 0, 0],
    memTotal: os.totalmem?.() ?? 0,
    memFree: os.freemem?.() ?? 0,
    port,
    host,
    protocol,
    codexAuth,
    ghAuth,
    authStorage,
  };

  const safe = (value) => String(value ?? '');
  const json = JSON.stringify({
    startedAt: data.startedAt.toISOString(),
    now: data.now.toISOString(),
    node: data.node,
    platform: data.platform,
    arch: data.arch,
    hostname: data.hostname,
    cpus: data.cpus,
    loadavg: data.loadavg,
    memTotal: data.memTotal,
    memFree: data.memFree,
    port: data.port,
    host: data.host,
    protocol: data.protocol,
    codexAuth: data.codexAuth,
    ghAuth: data.ghAuth,
    authStorage: data.authStorage,
  });
  
  // Escape JSON for safe injection in HTML script tag
  const escapedJson = json
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\u0027')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Maxwell Server Dashboard</title>
    <meta name="description" content="Dashboard di servizio per Maxwell" />
    <meta name="theme-color" content="#0f0d0e" />
    <style>
      :root {
        color-scheme: dark;
        --color-burgundy-950: #2d0a0f;
        --color-burgundy-900: #4a0e1a;
        --color-gold-400: #f4bf4f;
        --color-gold-500: #e6a23c;
        --color-bg-primary: #0f0d0e;
        --color-bg-surface: #1a1617;
        --color-bg-surface-elevated: #241f20;
        --color-text-primary: #f5f5f5;
        --color-text-secondary: #b8b2b3;
        --color-text-tertiary: #7a7577;
        --color-success: #52c41a;
        --color-error: #ff4d4f;
        --color-warning: #faad14;
        --panel-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
        --panel-border: rgba(255, 255, 255, 0.08);
        --panel-fill: rgba(26, 22, 23, 0.78);
        --panel-glow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI",
          Inter, system-ui, sans-serif;
        color: var(--color-text-primary);
        background: var(--color-bg-primary);
        min-height: 100vh;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background-image: linear-gradient(
          #0f0d0e,
          #1a1617 52%,
          #2d0a0f
        );
        z-index: 0;
      }

      .wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 40px 24px 64px;
        display: grid;
        gap: 28px;
        position: relative;
        z-index: 1;
      }

      header {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .kicker {
        font-family: "JetBrains Mono", "Fira Code", Consolas, "SFMono-Regular",
          ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 12px;
        color: var(--color-gold-400);
      }

      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 48px);
        line-height: 1.12;
      }

      .subtitle {
        max-width: 720px;
        font-size: 16px;
        color: var(--color-text-secondary);
      }

      .grid {
        display: grid;
        gap: 20px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .card {
        background: var(--panel-fill);
        border-radius: 18px;
        border: 1px solid var(--panel-border);
        padding: 18px 20px;
        box-shadow: var(--panel-shadow), var(--panel-glow);
        backdrop-filter: blur(14px) saturate(1.2);
        display: grid;
        gap: 12px;
        min-height: 140px;
      }

      .card h3 {
        margin: 0;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--color-text-tertiary);
      }

      .value {
        font-size: 28px;
        font-weight: 700;
      }

      .value small {
        font-size: 14px;
        font-weight: 600;
        color: var(--color-text-tertiary);
      }

      .tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(244, 191, 79, 0.18);
        color: var(--color-gold-400);
        border: 1px solid rgba(244, 191, 79, 0.3);
        font-family: "JetBrains Mono", "Fira Code", Consolas, "SFMono-Regular",
          ui-monospace, monospace;
        font-size: 12px;
      }

      .command {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .command button.tag {
        min-width: 90px;
        justify-content: center;
      }

      .command code {
        font-family: "JetBrains Mono", "Fira Code", Consolas, "SFMono-Regular",
          ui-monospace, monospace;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--color-text-primary);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }

      .hint {
        font-size: 12px;
        color: var(--color-text-tertiary);
      }

      button.tag {
        appearance: none;
        border: 1px solid rgba(244, 191, 79, 0.3);
        background: rgba(244, 191, 79, 0.18);
        color: var(--color-gold-400);
        cursor: pointer;
      }

      button.tag:hover {
        filter: brightness(1.08);
      }

      button.tag:focus-visible {
        outline: 2px solid var(--color-gold-400);
        outline-offset: 2px;
      }

      .tag[data-state="online"] {
        background: rgba(82, 196, 26, 0.16);
        color: #b2f59b;
        border-color: rgba(82, 196, 26, 0.4);
      }

      .tag[data-state="offline"] {
        background: rgba(255, 77, 79, 0.16);
        color: #ffb3b5;
        border-color: rgba(255, 77, 79, 0.4);
      }

      .list {
        display: grid;
        gap: 10px;
        font-size: 14px;
        color: var(--color-text-secondary);
      }

      .list span {
        color: var(--color-text-primary);
        font-weight: 600;
      }

      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .pill {
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--color-text-secondary);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 8px 12px;
        font-size: 13px;
        font-family: "JetBrains Mono", "Fira Code", Consolas, "SFMono-Regular",
          ui-monospace, monospace;
      }

      .footer {
        font-size: 12px;
        color: var(--color-text-tertiary);
        text-align: center;
      }

      @media (max-width: 720px) {
        .wrap {
          padding: 28px 18px 48px;
        }
        header {
          gap: 10px;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div class="kicker">Maxwell Runtime</div>
        <h1>Server control room</h1>
        <div class="subtitle">
          Panorama rapido dei segnali vitali del server. Aggiorna la pagina per
          un nuovo snapshot e usa i check live per verificare lo stato delle API.
        </div>
        <div class="row">
          <span class="tag" id="status-pill">loading</span>
          <span class="pill" id="clock-pill">--:--:--</span>
        </div>
      </header>

      <section class="grid">
        <article class="card">
          <h3>Uptime</h3>
          <div class="value" id="uptime-value">--</div>
          <div class="list">
            <div>Avvio <span id="started-at">--</span></div>
          </div>
        </article>
        <article class="card">
          <h3>Memoria</h3>
          <div class="value" id="memory-value">--</div>
          <div class="list">
            <div>Libera <span id="memory-free">--</span></div>
          </div>
        </article>
        <article class="card">
          <h3>Carico</h3>
          <div class="value" id="loadavg-value">--</div>
          <div class="list">
            <div>CPU <span id="cpu-count">--</span></div>
          </div>
        </article>
        <article class="card">
          <h3>Runtime</h3>
          <div class="value" id="node-value">--</div>
          <div class="list">
            <div>Host <span id="host-name">--</span></div>
            <div>OS <span id="platform-value">--</span></div>
          </div>
        </article>
      </section>

      <section class="grid">
        <article class="card">
          <h3>Autenticazione Codex</h3>
          <div class="list">
            <div>Login <span id="codex-auth-status" data-auth="${data.codexAuth.hasApiKey}">${data.codexAuth.hasApiKey ? '✅ Autenticato' : '❌ Non autenticato'}</span></div>
            <div>Metodo <span id="codex-auth-source">${safe(data.codexAuth.sourceLabel)}</span></div>
            <div>Binario <span>${data.codexAuth.codexBin}</span></div>
          </div>
          <div class="row" style="margin-top: 12px; flex-direction: column; align-items: flex-start;">
            ${!data.codexAuth.hasApiKey ? `
              <div class="command">
                <code>codex login --device-auth</code>
                <button type="button" class="tag" data-auth-type="codex" title="Avvia login">
                  Avvia login
                </button>
              </div>
              <div class="hint" data-auth-note="codex">Il link di login si apre in una nuova scheda (ed e' nei log).</div>
            ` : `
              <span class="tag" data-state="online">✅ Autenticato</span>
            `}
          </div>
        </article>
        <article class="card">
          <h3>Autenticazione GitHub</h3>
          <div class="list">
            <div>Login <span id="gh-auth-status" data-auth="${data.ghAuth.hasToken}">${data.ghAuth.hasToken ? '✅ Autenticato' : '❌ Non autenticato'}</span></div>
            <div>Metodo <span id="gh-auth-source">${safe(data.ghAuth.sourceLabel)}</span></div>
            <div>Binario <span>${data.ghAuth.ghBin}</span></div>
          </div>
          <div class="row" style="margin-top: 12px; flex-direction: column; align-items: flex-start;">
            ${!data.ghAuth.hasToken ? `
              <div class="command">
                <code>gh auth login --device</code>
                <button type="button" class="tag" data-auth-type="github" title="Avvia login">
                  Avvia login
                </button>
              </div>
              <div class="hint" data-auth-note="github">Il link di login si apre in una nuova scheda (ed e' nei log).</div>
            ` : `
              <span class="tag" data-state="online">✅ Autenticato</span>
            `}
          </div>
        </article>
        <article class="card">
          <h3>Archiviazione Auth</h3>
          <div class="list">
            <div>Directory <span id="auth-storage-dir">--</span></div>
            <div>Sorgente <span id="auth-storage-source">--</span></div>
            <div>.env <span id="auth-storage-env-file">--</span></div>
            <div>Stato .env <span id="auth-storage-env-status">--</span></div>
          </div>
        </article>
      </section>

      <section class="grid">
        <article class="card">
          <h3>Endpoint</h3>
          <div class="value" id="health-value">--</div>
          <div class="list">
            <div>Health check <span id="health-detail">--</span></div>
            <div>API base <span>${safe(data.protocol)}://${safe(data.host)}:${safe(data.port)}</span></div>
          </div>
        </article>
        <article class="card">
          <h3>Ambiente</h3>
          <div class="row">
            <span class="pill">Platform: <span id="platform-pill">--</span></span>
            <span class="pill">Arch: <span id="arch-pill">--</span></span>
            <span class="pill">Node: <span id="node-pill">--</span></span>
          </div>
        </article>
        <article class="card">
          <h3>Indicazioni</h3>
          <div class="list">
            <div>Chat API <span>/api/ai/chat</span></div>
            <div>Issue API <span>/api/ai/issue</span></div>
            <div>Health <span>/health</span></div>
            <div>Auth Status <a href="/auth" target="_blank" style="color: var(--color-gold-400); text-decoration: none;">/auth</a></div>
            <div>Auth Login <span style="color: #52c41a;">POST /auth/command</span></div>
          </div>
        </article>
      </section>

      <div class="footer">Maxwell dashboard snapshot generated at ${safe(data.now.toISOString())}</div>
    </div>

    <script>
      const data = JSON.parse('${escapedJson}');
      const el = (id) => document.getElementById(id);
      const fmtBytes = (bytes) => {
        if (!Number.isFinite(bytes)) return "--";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let value = bytes;
        let idx = 0;
        while (value >= 1024 && idx < units.length - 1) {
          value /= 1024;
          idx += 1;
        }
        return value.toFixed(1) + " " + units[idx];
      };

      const fmtDuration = (ms) => {
        if (!Number.isFinite(ms)) return "--";
        const total = Math.max(0, Math.floor(ms / 1000));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        return [
          String(hours).padStart(2, "0"),
          String(minutes).padStart(2, "0"),
          String(seconds).padStart(2, "0"),
        ].join(":");
      };

      const updateAuthNote = (type, message) => {
        const note = document.querySelector('[data-auth-note="' + type + '"]');
        if (!note || !message) return;
        note.textContent = message;
      };

      const openAuthPopup = () => {
        const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
        if (!popup) return null;
        popup.document.title = "Login in corso";
        popup.document.body.innerHTML =
          '<p style="font-family: system-ui; padding: 16px;">In attesa del link di login...</p>';
        return popup;
      };

      const navigatePopup = (popup, url) => {
        if (popup && !popup.closed) {
          popup.location.href = url;
          return true;
        }
        window.open(url, "_blank", "noopener,noreferrer");
        return false;
      };

      const startAuthCommand = async (type, button, popup) => {
        const original = button.textContent;
        button.textContent = "Avvio...";
        button.disabled = true;
        try {
          const res = await fetch("/auth/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload.error || "Errore avvio login");
          }
          
          let authUrl = payload.url;
          
          // Fallback URLs if not provided by API
          if (!authUrl) {
            if (type === 'codex') {
              authUrl = 'https://auth.openai.com/codex/device';
            } else if (type === 'github') {
              authUrl = 'https://github.com/login/device';
            }
          }
          
          let popupOpened = false;
          if (authUrl) {
            popupOpened = navigatePopup(popup, authUrl);
          }
          
          if (payload.code) {
            updateAuthNote(type, "Codice: " + payload.code + " (anche nei log).");
          } else if (authUrl && popupOpened) {
            updateAuthNote(type, "Link aperto nel browser (controlla i log per il codice).");
          } else if (authUrl) {
            // Popup was blocked, provide manual link
            updateAuthNote(type, 'Popup bloccato. Apri manualmente: <a href="' + authUrl + '" target="_blank" style="color: var(--color-gold-400);">' + authUrl + '</a>');
          } else {
            updateAuthNote(type, "Link disponibile nei log della console.");
          }
          
          button.textContent = "Avviato";
          setTimeout(() => {
            button.textContent = original;
            button.disabled = false;
          }, 2000);
        } catch (error) {
          updateAuthNote(type, error.message || "Errore avvio login");
          button.textContent = "Errore";
          setTimeout(() => {
            button.textContent = original;
            button.disabled = false;
          }, 2000);
        }
      };

      const setupAuthButtons = () => {
        document.querySelectorAll("[data-auth-type]").forEach((button) => {
          button.addEventListener("click", async () => {
            const type = button.dataset.authType;
            if (!type) return;
            const popup = openAuthPopup();
            if (!popup) {
              updateAuthNote(
                type,
                "Popup bloccato: abilita i popup per aprire il link."
              );
            }
            await startAuthCommand(type, button, popup);
          });
        });
      };

      const started = new Date(data.startedAt);
      const tick = () => {
        const now = new Date();
        el("clock-pill").textContent = now.toLocaleTimeString("it-IT");
        el("uptime-value").textContent = fmtDuration(now - started);
      };
      tick();
      setInterval(tick, 1000);

      el("started-at").textContent = started.toLocaleString("it-IT");
      el("memory-value").textContent = fmtBytes(data.memTotal);
      el("memory-free").textContent = fmtBytes(data.memFree);
      el("loadavg-value").textContent = data.loadavg.map((v) => v.toFixed(2)).join(" / ");
      el("cpu-count").textContent = data.cpus + " cores";
      el("node-value").textContent = data.node;
      el("host-name").textContent = data.hostname;
      el("platform-value").textContent = data.platform + " " + data.arch;
      el("platform-pill").textContent = data.platform;
      el("arch-pill").textContent = data.arch;
      el("node-pill").textContent = data.node;

      const storage = data.authStorage || {};
      const storageDir = storage.authDir || "Default (home)";
      const storageSource = storage.source || "default";
      const storageEnvFile = storage.envFile || "—";
      const storageEnvStatusMap = {
        disabled: "Disabilitato",
        missing: "Manca",
        "missing-auth-dir": "Variabile mancante",
        available: "Disponibile",
        loaded: "Caricato",
        written: "Aggiornato",
      };
      const storageEnvStatus =
        storageEnvStatusMap[storage.envFileStatus] || storage.envFileStatus || "—";

      const storageDirEl = el("auth-storage-dir");
      if (storageDirEl) storageDirEl.textContent = storageDir;
      const storageSourceEl = el("auth-storage-source");
      if (storageSourceEl) storageSourceEl.textContent = storageSource;
      const storageEnvFileEl = el("auth-storage-env-file");
      if (storageEnvFileEl) storageEnvFileEl.textContent = storageEnvFile;
      const storageEnvStatusEl = el("auth-storage-env-status");
      if (storageEnvStatusEl) storageEnvStatusEl.textContent = storageEnvStatus;

      // Update authentication status
      const codexAuthStatus = el("codex-auth-status");
      const codexAuthSource = el("codex-auth-source");
      const ghAuthStatus = el("gh-auth-status");
      const ghAuthSource = el("gh-auth-source");

      if (codexAuthStatus) {
        const codexStatus = data.codexAuth.hasApiKey ? '✅ Autenticato' : '❌ Non autenticato';
        codexAuthStatus.textContent = codexStatus;
        codexAuthStatus.dataset.auth = data.codexAuth.hasApiKey;
        codexAuthStatus.dataset.source = data.codexAuth.source;
        if (codexAuthSource) {
          codexAuthSource.textContent = data.codexAuth.sourceLabel || 'Codex CLI';
        }
      }

      if (ghAuthStatus) {
        const ghStatus = data.ghAuth.hasToken ? '✅ Autenticato' : '❌ Non autenticato';
        ghAuthStatus.textContent = ghStatus;
        ghAuthStatus.dataset.auth = data.ghAuth.hasToken;
        ghAuthStatus.dataset.source = data.ghAuth.source;
        if (ghAuthSource) {
          ghAuthSource.textContent = data.ghAuth.sourceLabel || 'GitHub CLI';
        }
      }

      const statusPill = el("status-pill");
      const healthValue = el("health-value");
      const healthDetail = el("health-detail");

      setupAuthButtons();

      const updateHealth = async () => {
        statusPill.textContent = "checking /health";
        statusPill.dataset.state = "checking";
        try {
          const res = await fetch("/health");
          if (!res.ok) throw new Error("status " + res.status);
          const payload = await res.json();
          healthValue.textContent = "OK";
          healthDetail.textContent = payload.status || "ok";
          statusPill.textContent = "online";
          statusPill.dataset.state = "online";
        } catch (error) {
          healthValue.textContent = "DOWN";
          healthDetail.textContent = "check failed";
          statusPill.textContent = "offline";
          statusPill.dataset.state = "offline";
        }
      };

      updateHealth();
      setInterval(updateHealth, 15000);
    </script>
  </body>
</html>`;
}

function buildPrompt({ prompt, messages, context }) {
  const systemParts = [];
  if (typeof prompt === 'string' && prompt.trim()) {
    systemParts.push(prompt.trim());
  }
  if (context?.userName) {
    systemParts.push(`Nome utente: ${context.userName}`);
  }
  if (context?.memory) {
    systemParts.push(`Memoria utente:\n${context.memory}`);
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

function runGhIssueCreate({ title, body, labels }) {
  return new Promise((resolve, reject) => {
    const repo = resolveGithubRepo();
    const args = ['issue', 'create', '--title', title, '--body', body];

    if (repo) {
      args.push('--repo', repo);
    }

    if (Array.isArray(labels)) {
      labels
        .map((label) => String(label).trim())
        .filter(Boolean)
        .forEach((label) => {
          args.push('--label', label);
        });
    }

    const child = spawnGhProcess(args);
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

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `gh exited with code ${code}`));
        return;
      }
      const urlMatch = stdout.match(/https?:\/\/\S+/);
      resolve({
        url: urlMatch ? urlMatch[0] : null,
        output: stdout.trim(),
      });
    });
  });
}

function runGhJson(args) {
  return new Promise((resolve, reject) => {
    const repo = resolveGithubRepo();
    const fullArgs = [...args];
    if (repo && !fullArgs.includes('--repo')) {
      fullArgs.push('--repo', repo);
    }
    const child = spawnGhProcess(fullArgs);
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

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `gh exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout || 'null'));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function runGhIssueComment({ number, body }) {
  return new Promise((resolve, reject) => {
    const repo = resolveGithubRepo();
    const args = ['issue', 'comment', String(number), '--body', body];
    if (repo) {
      args.push('--repo', repo);
    }
    const child = spawnGhProcess(args);
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `gh exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function runGhIssueAddLabels({ number, labels }) {
  return new Promise((resolve, reject) => {
    if (!labels.length) {
      resolve();
      return;
    }
    const repo = resolveGithubRepo();
    const args = ['issue', 'edit', String(number)];
    labels.forEach((label) => {
      args.push('--add-label', label);
    });
    if (repo) {
      args.push('--repo', repo);
    }
    const child = spawnGhProcess(args);
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `gh exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function listGhLabels() {
  const data = await runGhJson(['label', 'list', '--json', 'name']);
  if (!Array.isArray(data)) {
    return new Set();
  }
  return new Set(
    data
      .map((label) => label?.name)
      .filter((name) => typeof name === 'string')
  );
}

async function ensureGhLabel(label) {
  if (!label) return false;
  const labels = await listGhLabels();
  if (labels.has(label)) {
    return true;
  }
  return new Promise((resolve) => {
    const repo = resolveGithubRepo();
    const args = ['label', 'create', label, '--color', 'FBCA04'];
    if (repo) {
      args.push('--repo', repo);
    }
    const child = spawnGhProcess(args);
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', () => {
      resolve(false);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logError(`Label create failed (${label}): ${stderr.trim()}`);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

async function findExistingIssueByTitle(title) {
  const data = await runGhJson([
    'issue',
    'list',
    '--state',
    'open',
    '--limit',
    '50',
    '--search',
    `in:title "${title.replace(/"/g, '\\"')}"`,
    '--json',
    'number,title,url',
  ]);
  if (!Array.isArray(data)) return null;
  const normalized = title.trim().toLowerCase();
  return (
    data.find(
      (issue) =>
        typeof issue?.title === 'string' &&
        issue.title.trim().toLowerCase() === normalized
    ) ?? null
  );
}

function spawnCodexProcess(args) {
  const env = buildCodexEnv();
  if (process.platform === 'win32') {
    const lower = codexBin.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
      return spawn('cmd.exe', ['/c', codexBin, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: env ?? process.env,
      });
    }
  }
  return spawn(codexBin, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: env ?? process.env,
  });
}

function spawnGhProcess(args) {
  const env = buildGhEnv();
  if (process.platform === 'win32') {
    const lower = ghBin.toLowerCase();
    if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
      return spawn('cmd.exe', ['/c', ghBin, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: env ?? process.env,
      });
    }
  }
  return spawn(ghBin, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: env ?? process.env,
  });
}

const httpsOptions = resolveHttpsOptions();
const requestHandler = (req, res) => {
  const start = Date.now();
  const requestId = `${start}-${Math.random().toString(16).slice(2, 8)}`;
  const allowedOrigins = parseAllowedOrigins();
  const origin = req.headers.origin;
  const corsOrigin = resolveCorsOrigin(origin, allowedOrigins);
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : '';
  const remoteIp = req.socket?.remoteAddress || req.connection?.remoteAddress;
  const clientIp = forwardedIp || remoteIp || 'unknown';

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

  if (req.method === 'GET' && req.url === '/') {
    const protocol = httpsOptions ? 'https' : 'http';
    const html = buildDashboardHtml({ protocol });
    logLine(
      `${requestId} GET /\n  client=${clientIp}\n  status=${formatStatus(200)}\n  duration=${Date.now() - start}ms`
    );
    sendHtml(res, 200, html);
    return;
  }

  if (req.url === '/health') {
    logLine(
      `${requestId} GET /health\n  client=${clientIp}\n  status=${formatStatus(200)}\n  duration=${Date.now() - start}ms`
    );
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.url === '/auth') {
    const codexAuth = checkCodexAuth();
    const ghAuth = checkGhAuth();
    logLine(
      `${requestId} GET /auth\n  client=${clientIp}\n  status=${formatStatus(200)}\n  duration=${Date.now() - start}ms`
    );
    sendJson(res, 200, {
      codex: {
        hasApiKey: codexAuth.hasApiKey,
        apiKeyLength: codexAuth.apiKeyLength,
        bin: codexAuth.codexBin,
        source: codexAuth.source,
        sourceLabel: codexAuth.sourceLabel,
        status: codexAuth.status,
        loginCommand: 'codex login --device-auth'
      },
      github: {
        hasToken: ghAuth.hasToken,
        tokenLength: ghAuth.tokenLength,
        bin: ghAuth.ghBin,
        source: ghAuth.source,
        sourceLabel: ghAuth.sourceLabel,
        status: ghAuth.status,
        loginCommand: 'gh auth login --device'
      },
      storage: {
        enabled: authStorage.enabled,
        authDir: authStorage.authDir,
        codexDir: authStorage.codexDir,
        githubDir: authStorage.githubDir,
        source: authStorage.source,
        envFile: authStorage.envFile,
        envFileStatus: authStorage.envFileStatus,
        envFileWriteEnabled: authStorage.envFileWriteEnabled,
      }
    });
    return;
  }

  if (req.url === '/auth/command' && req.method === 'POST') {
    let authBody = '';
    req.on('data', (chunk) => {
      authBody += chunk.toString();
      if (authBody.length > maxBodySize) {
        logLine(`${requestId} auth payload too large (${authBody.length} bytes)`);
        res.writeHead(413);
        res.end();
        req.destroy();
      }
    });

    req.on('end', async () => {
      let payload;
      try {
        payload = authBody ? JSON.parse(authBody) : {};
      } catch (error) {
        logError(`${requestId} invalid auth JSON body`);
        sendJson(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      const type = payload?.type;
      if (type !== 'codex' && type !== 'github') {
        sendJson(res, 400, { error: 'Invalid auth type' });
        return;
      }

      const result =
        type === 'codex' ? await startCodexLogin() : await startGhLogin();
      if (!result.started) {
        const status = result.reason?.includes('already running') ? 409 : 500;
        sendJson(res, status, { error: result.reason || 'Login failed' });
        return;
      }

      logLine(
        `${requestId} POST /auth/command\n  client=${clientIp}\n  status=${formatStatus(202)}\n  duration=${Date.now() - start}ms\n  type=${type}`
      );
      sendJson(res, 202, {
        started: true,
        pid: result.pid,
        type,
        url: result.url ?? null,
        code: result.code ?? null,
      });
    });
    return;
  }

  if (req.url !== '/api/ai/chat' && req.url !== '/api/ai/issue') {
    logLine(
      `${requestId} ${req.method} ${req.url}\n  client=${clientIp}\n  status=${formatStatus(404)}\n  duration=${Date.now() - start}ms`
    );
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (req.method !== 'POST') {
    logLine(
      `${requestId} ${req.method} ${req.url}\n  client=${clientIp}\n  status=${formatStatus(405)}\n  duration=${Date.now() - start}ms`
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
      `${requestId} POST ${req.url}\n  client=${clientIp}\n  origin=${origin ?? 'unknown'}\n  size=${body.length}`
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
      if (req.url === '/api/ai/issue') {
        const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
        const issueBody =
          typeof payload?.body === 'string' ? payload.body.trim() : '';
        const labels = payload?.labels;

        if (!title || !issueBody) {
          sendJson(res, 400, { error: 'Missing title or body' });
          return;
        }

        const requestedLabels = Array.isArray(labels)
          ? labels.map((label) => String(label).trim()).filter(Boolean)
          : [];
        const baseLabels = ['supporto', 'Maxwell'];
        const targetLabels = Array.from(
          new Set([...requestedLabels, ...baseLabels])
        );

        const usableLabels = [];
        for (const label of targetLabels) {
          const ok = await ensureGhLabel(label);
          if (ok) usableLabels.push(label);
        }

        if (!usableLabels.includes('Maxwell')) {
          logError('Label Maxwell not available; proceeding without label');
        }
        if (!usableLabels.includes('supporto')) {
          logError('Label supporto not available; proceeding without label');
        }

        const existing = await findExistingIssueByTitle(title);
        if (existing) {
          logLine(`${requestId} gh issue comment start`);
          const ghStart = Date.now();
          await runGhIssueComment({ number: existing.number, body: issueBody });
          if (usableLabels.length) {
            await runGhIssueAddLabels({
              number: existing.number,
              labels: usableLabels,
            });
          }
          const ghElapsed = Date.now() - ghStart;
          logLine(`${requestId} gh issue comment done ${ghElapsed}ms`);
          sendJson(res, 200, {
            url: existing.url,
            existing: true,
            action: 'commented',
          });
          logLine(
            `${requestId} POST /api/ai/issue\n  status=${formatStatus(200)}\n  duration=${Date.now() - start}ms`
          );
          return;
        }

        logLine(`${requestId} gh issue create start`);
        const ghStart = Date.now();
        const result = await runGhIssueCreate({
          title,
          body: issueBody,
          labels: usableLabels,
        });
        const ghElapsed = Date.now() - ghStart;
        logLine(`${requestId} gh issue create done ${ghElapsed}ms`);
        sendJson(res, 200, { ...result, existing: false, action: 'created' });
        logLine(
          `${requestId} POST /api/ai/issue\n  status=${formatStatus(200)}\n  duration=${Date.now() - start}ms`
        );
        return;
      }

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
      logLine(
        `${requestId} POST /api/ai/chat\n  status=${formatStatus(200)}\n  duration=${Date.now() - start}ms`
      );
    } catch (error) {
      const route = req.url === '/api/ai/issue' ? '/api/ai/issue' : '/api/ai/chat';
      logError(
        `${requestId} POST ${route}\n  status=${formatStatus(500)}\n  duration=${Date.now() - start}ms\n  error=${error.message}`
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
  const baseUrl = `${protocol}://${host}:${port}`;
  process.stdout.write(`AI support server listening on ${baseUrl}\n`);
  if (host === '0.0.0.0') {
    const localAddresses = getLocalIPv4Addresses();
    if (localAddresses.length) {
      const urls = localAddresses
        .map((address) => `${protocol}://${address}:${port}`)
        .join(', ');
      process.stdout.write(`Local network URLs: ${urls}\n`);
    }
  }
  if (verbose) {
    logLine(`Verbose logging enabled`);
    if (logMessages) {
      logLine(`Message length logging enabled`);
    }
    logLine(`Codex binary: ${codexBin}`);
  }
});
