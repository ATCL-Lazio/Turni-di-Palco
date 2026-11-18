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
