import { describe, expect, it } from 'vitest';
import { localizeTurnRegistrationError } from '../state/store';

describe('already_registered error (issue #324)', () => {
  it('maps already_registered to a user-friendly message', () => {
    expect(localizeTurnRegistrationError(new Error('already_registered'))).toBe(
      'Hai già registrato un turno per questo evento.'
    );
  });

  it('maps already_registered from plain string', () => {
    expect(localizeTurnRegistrationError('already_registered')).toBe(
      'Hai già registrato un turno per questo evento.'
    );
  });

  it('maps already_registered from object with message property', () => {
    expect(localizeTurnRegistrationError({ message: 'already_registered' })).toBe(
      'Hai già registrato un turno per questo evento.'
    );
  });
});
