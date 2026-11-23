// Run: node --test apps/pwa/api/ai/_guards.test.js (no network; fetch is faked).
// Il prefisso "_" evita che Vercel lo esponga come route.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';

const guard = await import('./_guard.js');
const { createIssueHandler } = await import('./issue.js');

const USER = { id: 'user-1', token: 'jwt-test' };

function fakeRes() {
  return {
    statusCode: 0,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    send(payload) { this.body = payload; return this; },
    writeHead(code) { this.statusCode = code; },
    end() {},
  };
}

function jsonResponse(status, payload) {
  const text = payload === undefined ? '' : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

// fetch finto: risponde alle RPC in base al nome e registra le chiamate.
function fakeFetch(handlers) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined });
    for (const [match, handler] of Object.entries(handlers)) {
      if (url.includes(match)) return handler(url, init);
    }
    throw new Error(`fetch inatteso: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

const okUser = async () => USER;
const confirmedBody = { confirmed: true, title: 'La mappa non si carica', body: 'Dettagli', labels: ['bug', 'admin'] };

test('issueFingerprint normalizza maiuscole, accenti e punteggiatura', () => {
  const a = guard.issueFingerprint('La mappa NON si carica!!');
  const b = guard.issueFingerprint('  la mappa non si   càrica ');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, guard.issueFingerprint('Il biglietto non si attiva'));
});

test('persistentRateLimit usa il conteggio di Postgres', async () => {
  guard._resetMemoryRateLimit();
  const fetchImpl = fakeFetch({ '/rpc/ai_rate_limit_hit': () => jsonResponse(200, 21) });
  const allowed = await guard.persistentRateLimit(
    USER,
    { scope: 'chat_minute', max: 20, windowSeconds: 60 },
    { fetchImpl },
  );
  assert.equal(allowed, false);
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, 'Bearer jwt-test');
  assert.deepEqual(fetchImpl.calls[0].body, { p_scope: 'chat_minute', p_window_seconds: 60 });
});

test('persistentRateLimit: fail open solo se richiesto', async () => {
  guard._resetMemoryRateLimit();
  const fetchImpl = fakeFetch({ '/rpc/': () => jsonResponse(500, { message: 'down' }) });
  const opts = { scope: 'chat_day', max: 5, windowSeconds: 86400 };
  assert.equal(await guard.persistentRateLimit(USER, { ...opts, failOpen: true }, { fetchImpl }), true);
  assert.equal(await guard.persistentRateLimit(USER, opts, { fetchImpl }), null);
});

test('issue: senza conferma esplicita non chiama nulla', async () => {
  const fetchImpl = fakeFetch({});
  const res = fakeRes();
  await createIssueHandler(
    { method: 'POST', body: { ...confirmedBody, confirmed: 'yes' } },
    res,
    { fetchImpl, requireUser: okUser, githubToken: 'gh' },
  );
  assert.equal(res.statusCode, 400);
  assert.equal(fetchImpl.calls.length, 0);
});

test('issue: duplicato restituisce la issue esistente senza crearne una nuova', async () => {
  const fetchImpl = fakeFetch({
    '/rpc/ai_issue_reserve': () => jsonResponse(200, { status: 'duplicate', number: 42, url: 'https://github.com/o/r/issues/42' }),
  });
  const res = fakeRes();
  await createIssueHandler({ method: 'POST', body: confirmedBody }, res, { fetchImpl, requireUser: okUser, githubToken: 'gh' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.existing, true);
  assert.equal(res.body.number, 42);
  assert.ok(!fetchImpl.calls.some((c) => c.url.includes('api.github.com')));
});

test('issue: tetto raggiunto risponde 429', async () => {
  for (const status of ['user_limit', 'global_limit']) {
    const fetchImpl = fakeFetch({ '/rpc/ai_issue_reserve': () => jsonResponse(200, { status }) });
    const res = fakeRes();
    await createIssueHandler({ method: 'POST', body: confirmedBody }, res, { fetchImpl, requireUser: okUser, githubToken: 'gh' });
    assert.equal(res.statusCode, 429);
    assert.ok(!fetchImpl.calls.some((c) => c.url.includes('api.github.com')));
  }
});

test('issue: database non raggiungibile = nessuna issue (fail closed)', async () => {
  const fetchImpl = fakeFetch({ '/rpc/': () => jsonResponse(503, {}) });
  const res = fakeRes();
  await createIssueHandler({ method: 'POST', body: confirmedBody }, res, { fetchImpl, requireUser: okUser, githubToken: 'gh' });
  assert.equal(res.statusCode, 503);
  assert.ok(!fetchImpl.calls.some((c) => c.url.includes('api.github.com')));
});

test('issue: prenotata, creata su GitHub e chiusa nel registro', async () => {
  const fetchImpl = fakeFetch({
    '/rpc/ai_issue_reserve': () => jsonResponse(200, { status: 'reserved', id: 7 }),
    '/rpc/ai_issue_finish': () => jsonResponse(204),
    'api.github.com': () => jsonResponse(201, { number: 99, html_url: 'https://github.com/o/r/issues/99' }),
  });
  const res = fakeRes();
  await createIssueHandler({ method: 'POST', body: confirmedBody }, res, { fetchImpl, requireUser: okUser, githubToken: 'gh' });
  assert.equal(res.statusCode, 201);
  const gh = fetchImpl.calls.find((c) => c.url.includes('api.github.com'));
  assert.deepEqual(gh.body.labels.sort(), ['Maxwell', 'bug', 'supporto']);
  assert.match(gh.body.body, /confermata dall'utente/);
  const finish = fetchImpl.calls.find((c) => c.url.includes('ai_issue_finish'));
  assert.deepEqual(finish.body, { p_id: 7, p_issue_number: 99, p_issue_url: 'https://github.com/o/r/issues/99' });
});

test('issue: errore GitHub libera la prenotazione', async () => {
  const fetchImpl = fakeFetch({
    '/rpc/ai_issue_reserve': () => jsonResponse(200, { status: 'reserved', id: 8 }),
    '/rpc/ai_issue_finish': () => jsonResponse(204),
    'api.github.com': () => jsonResponse(422, { message: 'Validation Failed' }),
  });
  const res = fakeRes();
  await createIssueHandler({ method: 'POST', body: confirmedBody }, res, { fetchImpl, requireUser: okUser, githubToken: 'gh' });
  assert.equal(res.statusCode, 502);
  const finish = fetchImpl.calls.find((c) => c.url.includes('ai_issue_finish'));
  assert.deepEqual(finish.body, { p_id: 8, p_issue_number: null, p_issue_url: null });
});
