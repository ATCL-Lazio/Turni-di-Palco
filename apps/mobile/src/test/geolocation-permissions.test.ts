import { describe, expect, it } from 'vitest';
import { GEOLOCATION_FAILURE_MESSAGES, mapGeolocationErrorCode } from '../state/store';

describe('mapGeolocationErrorCode', () => {
  it('distinguishes a denied permission from a timeout (#323)', () => {
    // W3C Geolocation API error codes.
    expect(mapGeolocationErrorCode(1)).toBe('permission_denied');
    expect(mapGeolocationErrorCode(2)).toBe('position_unavailable');
    expect(mapGeolocationErrorCode(3)).toBe('timeout');
  });

  it('falls back to "unknown" for unset or unexpected codes', () => {
    expect(mapGeolocationErrorCode(undefined)).toBe('unknown');
    expect(mapGeolocationErrorCode(0)).toBe('unknown');
    expect(mapGeolocationErrorCode(99)).toBe('unknown');
  });
});

describe('GEOLOCATION_FAILURE_MESSAGES', () => {
  it('provides a non-empty localized message for every reason', () => {
    const reasons = [
      'unsupported',
      'permission_denied',
      'position_unavailable',
      'timeout',
      'unknown',
    ] as const;
    for (const reason of reasons) {
      expect(GEOLOCATION_FAILURE_MESSAGES[reason]).toBeTypeOf('string');
      expect(GEOLOCATION_FAILURE_MESSAGES[reason].length).toBeGreaterThan(0);
    }
  });

  it('tells the user how to recover from a denied permission', () => {
    expect(GEOLOCATION_FAILURE_MESSAGES.permission_denied.toLowerCase()).toContain('impostazioni');
  });
});
