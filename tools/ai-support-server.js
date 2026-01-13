#!/usr/bin/env node
const http = require('node:http');
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const port = Number(process.env.AI_SUPPORT_PORT) || 8787;
const host = process.env.AI_SUPPORT_HOST || '127.0.0.1';
const codexBin = process.env.CODEX_BIN || 'codex';
const codexArgs = process.env.CODEX_ARGS ? process.env.CODEX_ARGS.split(' ') : [];
const maxBodySize = 1_000_000;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
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
    const child = spawn(codexBin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.url !== '/api/ai/chat') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > maxBodySize) {
      res.writeHead(413);
      res.end();
      req.destroy();
    }
  });

  req.on('end', async () => {
    let payload;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch (error) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    try {
      const prompt = buildPrompt(payload ?? {});
      const reply = await runCodex(prompt);
      sendJson(res, 200, { reply });
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Codex failed' });
    }
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `AI support server listening on http://${host}:${port}\n`
  );
});
