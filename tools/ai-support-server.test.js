// Run: node --test tools/ai-support-server.test.js (no network; fake env values only).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const serverPath = path.join(__dirname, 'ai-support-server.js');

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startServer(env) {
  const port = await freePort();
  const child = spawn(process.execPath, [serverPath], {
    env: {
      PATH: process.env.PATH,
      AI_SUPPORT_PORT: String(port),
      AI_SUPPORT_HOST: '127.0.0.1',
      AI_SUPPORT_HTTPS: '0',
      AI_SUPPORT_VERBOSE: '0',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => String(d).includes('listening') && resolve());
    child.once('error', reject);
    child.once('exit', () => reject(new Error('server exited')));
  });
  return { port, stop: () => child.kill('SIGKILL') };
}

function request(port, method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('fails closed when no tokens are configured', async () => {
  const s = await startServer({});
  try {
    assert.equal(await request(s.port, 'GET', '/health'), 200);
    assert.equal(await request(s.port, 'POST', '/api/ai/chat', { body: '{}' }), 503);
    assert.equal(await request(s.port, 'POST', '/api/ai/issue', { body: '{}' }), 503);
  } finally {
    s.stop();
  }
});

test('rejects wrong tokens and accepts the right ones', async () => {
  const s = await startServer({ AI_SUPPORT_API_KEY: 'test-key', AI_SUPPORT_API_TOKEN: 'test-token' });
  try {
    const bad = { 'x-ai-support-token': 'nope' };
    assert.equal(await request(s.port, 'POST', '/api/ai/chat', { headers: bad, body: '{}' }), 401);
    assert.equal(await request(s.port, 'POST', '/api/ai/issue', { headers: bad, body: '{}' }), 401);
    // The chat key must not unlock the issue route.
    assert.equal(
      await request(s.port, 'POST', '/api/ai/issue', {
        headers: { 'x-ai-support-token': 'test-key' },
        body: '{}',
      }),
      401
    );
    // A valid token passes auth; the invalid body is rejected later, with no external call.
    const ok = await request(s.port, 'POST', '/api/ai/chat', {
      headers: { authorization: 'Bearer test-key' },
      body: 'not json',
    });
    assert.ok(ok !== 401 && ok !== 503, `unexpected status ${ok}`);
  } finally {
    s.stop();
  }
});

test('admin routes need the flag and a token', async () => {
  const off = await startServer({ AI_SUPPORT_API_TOKEN: 'test-token' });
  const on = await startServer({ AI_SUPPORT_API_TOKEN: 'test-token', AI_SUPPORT_ADMIN_ENABLED: '1' });
  try {
    assert.equal(
      await request(off.port, 'GET', '/auth', { headers: { 'x-ai-support-token': 'test-token' } }),
      403
    );
    assert.equal(await request(on.port, 'GET', '/auth'), 401);
    assert.equal(await request(on.port, 'POST', '/auth/command', { body: '{"type":"github"}' }), 401);
  } finally {
    off.stop();
    on.stop();
  }
});
