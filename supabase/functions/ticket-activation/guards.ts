// Pure decision helpers for the ticket-activation edge function.
// Kept free of imports so they can be unit tested with `deno test` without
// network access (see guards.test.ts).

export const ATTEMPT_WINDOW_MINUTES = 10;
export const MAX_ATTEMPTS_PER_USER = 20;
export const MAX_ATTEMPTS_PER_IP = 60;

export type AttemptDecision = { allowed: true } | { allowed: false; scope: 'user' | 'ip' };

/**
 * Decides whether an activation attempt is allowed, given how many attempts
 * (including the current one) were recorded inside the window.
 */
export function decideAttemptLimit(
  userAttempts: number,
  ipAttempts: number | null,
  limits: { user: number; ip: number } = { user: MAX_ATTEMPTS_PER_USER, ip: MAX_ATTEMPTS_PER_IP },
): AttemptDecision {
  if (userAttempts > limits.user) return { allowed: false, scope: 'user' };
  if (ipAttempts !== null && ipAttempts > limits.ip) return { allowed: false, scope: 'ip' };
  return { allowed: true };
}

/**
 * Manual activation by event + ticket number (details) is allowed only for a
 * ticket explicitly bound to the caller. Unbound tickets (attendee_id NULL)
 * can still be activated with the ticket QR (activate_hash).
 */
export function canActivateByDetails(attendeeId: string | null | undefined, callerId: string): boolean {
  return typeof attendeeId === 'string' && attendeeId !== '' && attendeeId === callerId;
}

/**
 * Activation by ticket number is an operator flow: the ticket must have been
 * reserved by the caller. Tickets without a recorded reserving admin
 * (legacy rows, or the admin deleted their account) can be activated only by
 * an admin.
 */
export function canActivateByTicketNumber(
  reservedBy: string | null | undefined,
  callerId: string,
  callerIsAdmin: boolean,
): boolean {
  if (typeof reservedBy === 'string' && reservedBy !== '') return reservedBy === callerId;
  return callerIsAdmin;
}

/**
 * An attendee-bound ticket scanned through its QR must belong to the caller.
 * Unbound tickets stay claimable by whoever holds the QR.
 */
export function canActivateByHash(attendeeId: string | null | undefined, callerId: string): boolean {
  if (typeof attendeeId !== 'string' || attendeeId === '') return true;
  return attendeeId === callerId;
}

// ---------------------------------------------------------------------------
// Ticket issuing: random bearer value + human-typable redeem code
// ---------------------------------------------------------------------------

// Crockford base32 without I, L, O, U (32 symbols, so a masked random byte is unbiased).
export const REDEEM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const REDEEM_CODE_LENGTH = 10;
const REDEEM_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;
const TICKET_VALUE_PATTERN = /^[0-9a-f]{64}$/;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 256 random bits as 64 lowercase hex characters, unrelated to any ticket field. */
export function generateTicketValue(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function isTicketValue(value: unknown): value is string {
  return typeof value === 'string' && TICKET_VALUE_PATTERN.test(value);
}

/** 10 random symbols from the unambiguous alphabet. */
export function generateRedeemCode(): string {
  const bytes = new Uint8Array(REDEEM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => REDEEM_CODE_ALPHABET[b & 31]).join('');
}

/** Display form: XXXXX-XXXXX. */
export function formatRedeemCode(normalized: string): string {
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

/**
 * Uppercases and strips spaces/dashes. Typical look-alike typos are folded
 * (O to 0, I and L to 1), which is safe because those letters are never issued.
 * Returns null when the result is not a well-formed code.
 */
export function normalizeRedeemCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 64) return null;
  const cleaned = input.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return REDEEM_CODE_PATTERN.test(cleaned) ? cleaned : null;
}

/**
 * Keyed tag (HMAC-SHA256, hex) binding a redeem code to one ticket value.
 * Parameters are deliberately neutral: `keyText` is the server-side pepper,
 * `ticketValue` the ticket identifier and `material` the normalised input.
 */
export async function computeVerifier(keyText: string, ticketValue: string, material: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyText),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const tag = await crypto.subtle.sign('HMAC', key, enc.encode(`ticket-redeem:v1:${ticketValue}:${material}`));
  return toHex(new Uint8Array(tag));
}

/** Constant-time comparison of two strings (length difference is folded into the result). */
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** True when the supplied input normalises to a code whose tag matches the stored verifier. */
export async function matchesStoredVerifier(
  keyText: string,
  ticketValue: string,
  suppliedInput: unknown,
  storedVerifier: string,
): Promise<boolean> {
  const normalized = normalizeRedeemCode(suppliedInput);
  if (!normalized) return false;
  const candidate = await computeVerifier(keyText, ticketValue, normalized);
  return constantTimeEqual(candidate, storedVerifier);
}

export type DetailsDecision = 'allow' | 'not_found' | 'forbidden';

/**
 * Decision for manual activation by event + ticket number.
 * - Row with a verifier: only a matching redeem code allows it (attendee_id is
 *   irrelevant, the code proves possession); anything else looks like "not found".
 * - Legacy row without a verifier: the attendee_id rule applies as before.
 */
export function decideDetailsActivation(row: {
  attendeeId: string | null | undefined;
  hasVerifier: boolean;
  codeMatches: boolean;
  callerId: string;
}): DetailsDecision {
  if (row.hasVerifier) return row.codeMatches ? 'allow' : 'not_found';
  return canActivateByDetails(row.attendeeId, row.callerId) ? 'allow' : 'forbidden';
}

/** A ticket may be re-issued only by its reserving admin and only while not activated. */
export function canReissueTicket(
  existing: { reservedBy: string | null | undefined; activatedBy: string | null | undefined },
  callerId: string,
): boolean {
  return !existing.activatedBy && typeof existing.reservedBy === 'string' && existing.reservedBy === callerId;
}

export function extractClientIp(headers: { get(name: string): string | null }): string | null {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    (headers.get('x-forwarded-for') ?? '').split(',')[0],
  ];
  for (const candidate of candidates) {
    const value = (candidate ?? '').trim();
    if (value && value.length <= 64) return value;
  }
  return null;
}
