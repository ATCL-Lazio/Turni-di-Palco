import { describe, expect, it, beforeEach } from 'vitest';
import {
  suppressSignedInNavigation,
  setSuppressSignedInNavigation,
  withSuppressSignedInNavigation,
} from '../state/store';

describe('withSuppressSignedInNavigation', () => {
  beforeEach(() => {
    setSuppressSignedInNavigation(false);
  });

  it('sets the flag while the verification is running and resets it afterward', async () => {
    await withSuppressSignedInNavigation(async () => {
      expect(suppressSignedInNavigation).toBe(true);
      await Promise.resolve();
    });

    expect(suppressSignedInNavigation).toBe(false);
  });

  it('always resets the flag even when the verification throws', async () => {
    await expect(
      withSuppressSignedInNavigation(async () => {
        expect(suppressSignedInNavigation).toBe(true);
        throw new Error('verification failed');
      })
    ).rejects.toThrow('verification failed');

    expect(suppressSignedInNavigation).toBe(false);
  });
});
