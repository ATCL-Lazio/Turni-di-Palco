import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  canActivateByDetails,
  canActivateByHash,
  canActivateByTicketNumber,
  canReissueTicket,
  computeVerifier,
  constantTimeEqual,
  decideAttemptLimit,
  decideDetailsActivation,
  formatRedeemCode,
  generateRedeemCode,
  generateTicketValue,
  matchesStoredVerifier,
  normalizeRedeemCode,
  REDEEM_CODE_ALPHABET,
  extractClientIp,
} from './guards.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

Deno.test('attempt limit: allows up to the user limit and blocks beyond it', () => {
  assertEquals(decideAttemptLimit(20, 1), { allowed: true });
  assertEquals(decideAttemptLimit(21, 1), { allowed: false, scope: 'user' });
});

Deno.test('attempt limit: per-IP limit applies independently and may be unknown', () => {
  assertEquals(decideAttemptLimit(1, 60), { allowed: true });
  assertEquals(decideAttemptLimit(1, 61), { allowed: false, scope: 'ip' });
  assertEquals(decideAttemptLimit(1, null), { allowed: true });
});

Deno.test('details: only the bound attendee may activate; unbound is denied', () => {
  assert(canActivateByDetails(USER, USER));
  assert(!canActivateByDetails(OTHER, USER));
  assert(!canActivateByDetails(null, USER));
  assert(!canActivateByDetails(undefined, USER));
  assert(!canActivateByDetails('', USER));
});

Deno.test('ticket number: reserving admin, or admin for orphaned tickets', () => {
  assert(canActivateByTicketNumber(USER, USER, false));
  assert(!canActivateByTicketNumber(OTHER, USER, false));
  assert(!canActivateByTicketNumber(OTHER, USER, true));
  assert(!canActivateByTicketNumber(null, USER, false));
  assert(canActivateByTicketNumber(null, USER, true));
});

Deno.test('hash: bound ticket requires the attendee, unbound stays open to QR holders', () => {
  assert(canActivateByHash(null, USER));
  assert(canActivateByHash(USER, USER));
  assert(!canActivateByHash(OTHER, USER));
});

Deno.test('client ip extraction prefers proxy headers and ignores junk', () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
  assertEquals(extractClientIp(h({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' })), '203.0.113.5');
  assertEquals(extractClientIp(h({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1' })), '198.51.100.7');
  assertEquals(extractClientIp(h({})), null);
});

Deno.test('ticket value: 64 lowercase hex, different each time', () => {
  const a = generateTicketValue();
  assert(/^[0-9a-f]{64}$/.test(a));
  assertNotEquals(a, generateTicketValue());
});

Deno.test('redeem code: 10 symbols from the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateRedeemCode();
    assertEquals(code.length, 10);
    for (const ch of code) assert(REDEEM_CODE_ALPHABET.includes(ch));
  }
  assertEquals(REDEEM_CODE_ALPHABET.length, 32);
  for (const bad of ['I', 'L', 'O', 'U']) assert(!REDEEM_CODE_ALPHABET.includes(bad));
  assertEquals(formatRedeemCode('ABCDE12345'), 'ABCDE-12345');
});

Deno.test('redeem code normalisation', () => {
  assertEquals(normalizeRedeemCode('abcde-12345'), 'ABCDE12345');
  assertEquals(normalizeRedeemCode(' abcde 12345 '), 'ABCDE12345');
  assertEquals(normalizeRedeemCode('ABCDE-1234'), null);
  assertEquals(normalizeRedeemCode('ABCDE-123456'), null);
  assertEquals(normalizeRedeemCode('ABCDE-1234U'), null);
  assertEquals(normalizeRedeemCode('ABCDE-1234!'), null);
  assertEquals(normalizeRedeemCode(undefined), null);
  assertEquals(normalizeRedeemCode('x'.repeat(500)), null);
  assertEquals(normalizeRedeemCode('ABCDE-1O1IL'), 'ABCDE10111');
});

Deno.test('verifier: keyed, bound to the ticket, constant-time compare', async () => {
  const v = await computeVerifier('pepper-a', 'a'.repeat(64), 'ABCDE12345');
  assert(/^[0-9a-f]{64}$/.test(v));
  assertEquals(v, await computeVerifier('pepper-a', 'a'.repeat(64), 'ABCDE12345'));
  assertNotEquals(v, await computeVerifier('pepper-b', 'a'.repeat(64), 'ABCDE12345'));
  assertNotEquals(v, await computeVerifier('pepper-a', 'b'.repeat(64), 'ABCDE12345'));
  assertNotEquals(v, await computeVerifier('pepper-a', 'a'.repeat(64), 'ABCDE12346'));
  assert(constantTimeEqual(v, v));
  assert(!constantTimeEqual(v, v.slice(0, -1)));
  assert(!constantTimeEqual(v, 'f'.repeat(64)));
});

Deno.test('stored verifier match accepts display form and rejects wrong or malformed input', async () => {
  const t = 'c'.repeat(64);
  const stored = await computeVerifier('pep', t, 'ABCDE12345');
  assert(await matchesStoredVerifier('pep', t, 'abcde-12345', stored));
  assert(!await matchesStoredVerifier('pep', t, 'ABCDE-12346', stored));
  assert(!await matchesStoredVerifier('pep', t, '', stored));
  assert(!await matchesStoredVerifier('pep', t, undefined, stored));
  assert(!await matchesStoredVerifier('other', t, 'ABCDE12345', stored));
});

Deno.test('details decision matrix', () => {
  const base = { callerId: USER };
  assertEquals(decideDetailsActivation({ ...base, attendeeId: null, hasVerifier: true, codeMatches: true }), 'allow');
  assertEquals(decideDetailsActivation({ ...base, attendeeId: OTHER, hasVerifier: true, codeMatches: true }), 'allow');
  assertEquals(decideDetailsActivation({ ...base, attendeeId: USER, hasVerifier: true, codeMatches: false }), 'not_found');
  assertEquals(decideDetailsActivation({ ...base, attendeeId: null, hasVerifier: true, codeMatches: false }), 'not_found');
  assertEquals(decideDetailsActivation({ ...base, attendeeId: USER, hasVerifier: false, codeMatches: false }), 'allow');
  assertEquals(decideDetailsActivation({ ...base, attendeeId: OTHER, hasVerifier: false, codeMatches: true }), 'forbidden');
  assertEquals(decideDetailsActivation({ ...base, attendeeId: null, hasVerifier: false, codeMatches: true }), 'forbidden');
});

Deno.test('reissue: only the reserving admin, only while not activated', () => {
  assert(canReissueTicket({ reservedBy: USER, activatedBy: null }, USER));
  assert(!canReissueTicket({ reservedBy: USER, activatedBy: OTHER }, USER));
  assert(!canReissueTicket({ reservedBy: OTHER, activatedBy: null }, USER));
  assert(!canReissueTicket({ reservedBy: null, activatedBy: null }, USER));
});
