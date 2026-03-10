import { describe, expect, it } from 'vitest';
import {
  isManualTicketActivatedInSession,
  isTicketHashActivatedInSession,
  listLocalTicketRecords,
  parseTicketQrValue,
} from '../services/ticket-activation';

// ─── parseTicketQrValue ───────────────────────────────────────────────────────

const VALID_HASH = 'a'.repeat(64);
const VALID_HASH_UPPER = 'A'.repeat(64);
const VALID_HASH_MIXED = 'aAbBcCdDeEfF0123456789aAbBcCdDeEfF0123456789aAbBcCdDeEfF01234567';

describe('parseTicketQrValue', () => {
  it('returns a 64-char lowercase hash as-is', () => {
    expect(parseTicketQrValue(VALID_HASH)).toBe(VALID_HASH);
  });

  it('normalises uppercase hex to lowercase', () => {
    expect(parseTicketQrValue(VALID_HASH_UPPER)).toBe(VALID_HASH_UPPER.toLowerCase());
  });

  it('normalises mixed-case hex to lowercase', () => {
    expect(parseTicketQrValue(VALID_HASH_MIXED)).toBe(VALID_HASH_MIXED.toLowerCase());
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseTicketQrValue(`  ${VALID_HASH}  `)).toBe(VALID_HASH);
  });

  it('returns null for a hash that is too short', () => {
    expect(parseTicketQrValue('a'.repeat(63))).toBeNull();
  });

  it('returns null for a hash that is too long', () => {
    expect(parseTicketQrValue('a'.repeat(65))).toBeNull();
  });

  it('returns null for a string with non-hex characters', () => {
    expect(parseTicketQrValue('g'.repeat(64))).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseTicketQrValue('')).toBeNull();
  });

  it('returns null for a plain JSON payload (not a hash)', () => {
    const json = JSON.stringify({ circuit: 'ATCL', eventID: '123', ticketNumber: '456' });
    expect(parseTicketQrValue(json)).toBeNull();
  });

  it('parses a legacy turni://ticket/ URI', () => {
    expect(parseTicketQrValue(`turni://ticket/${VALID_HASH}`)).toBe(VALID_HASH);
  });

  it('strips query string from a legacy URI', () => {
    expect(parseTicketQrValue(`turni://ticket/${VALID_HASH}?foo=bar`)).toBe(VALID_HASH);
  });

  it('normalises uppercase hash inside a legacy URI', () => {
    expect(parseTicketQrValue(`turni://ticket/${VALID_HASH_UPPER}`)).toBe(
      VALID_HASH_UPPER.toLowerCase()
    );
  });

  it('returns null for a legacy URI with an invalid hash segment', () => {
    expect(parseTicketQrValue('turni://ticket/not-a-hash')).toBeNull();
  });

  it('returns null for a manual-ticket: prefixed code', () => {
    expect(parseTicketQrValue(`manual-ticket:event-1:ticket-1`)).toBeNull();
  });
});

// ─── Session-tracking helpers ─────────────────────────────────────────────────

describe('isTicketHashActivatedInSession', () => {
  it('returns false for a hash not in the session store', () => {
    expect(isTicketHashActivatedInSession(VALID_HASH)).toBe(false);
  });

  it('returns false for an invalid hash', () => {
    expect(isTicketHashActivatedInSession('not-a-hash')).toBe(false);
  });
});

describe('isManualTicketActivatedInSession', () => {
  it('returns false for an event/ticket pair not in the session store', () => {
    expect(isManualTicketActivatedInSession('evt-1', '12345')).toBe(false);
  });
});

describe('listLocalTicketRecords', () => {
  it('returns an array (empty if no tickets have been generated this session)', () => {
    const records = listLocalTicketRecords();
    expect(Array.isArray(records)).toBe(true);
  });
});
