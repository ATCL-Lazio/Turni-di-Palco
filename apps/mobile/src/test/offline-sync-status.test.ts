import { describe, expect, it } from 'vitest';
import { resolveTurnSyncStatusFromRpc } from '../state/store';

describe('resolveTurnSyncStatusFromRpc', () => {
  it('returns synced_duplicate when server reports turn already registered', () => {
    expect(resolveTurnSyncStatusFromRpc({
      turn_registered: false,
      boost_requested: true,
      boost_applied: false,
    })).toBe('synced_duplicate');
  });

  it('returns failed_boost_fallback when turn is new but boost is not applied', () => {
    expect(resolveTurnSyncStatusFromRpc({
      turn_registered: true,
      boost_requested: true,
      boost_applied: false,
    })).toBe('failed_boost_fallback');
  });

  it('returns synced for a successful synced turn', () => {
    expect(resolveTurnSyncStatusFromRpc({
      turn_registered: true,
      boost_requested: true,
      boost_applied: true,
    })).toBe('synced');
  });
});
