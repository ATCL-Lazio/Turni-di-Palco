import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  canActivateByDetails,
  canActivateByHash,
  canActivateByTicketNumber,
  decideAttemptLimit,
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
