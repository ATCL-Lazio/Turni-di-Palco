// Tests for analytics.ts — verifies GDPR-grade pseudonymization via Edge Function.
// Issue #1086: hashing moved server-side; VITE_ANALYTICS_SALT removed from client bundle.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAnalyticsCache,
  getUserHash,
  setAnalyticsAuthToken,
} from '../services/analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuccessResponse(hash: string): Response {
  return new Response(JSON.stringify({ hash }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeErrorResponse(status: number): Response {
  return new Response(JSON.stringify({ error: 'error' }), { status });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearAnalyticsCache();
  setAnalyticsAuthToken(null);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getUserHash — null/undefined shortcuts
// ---------------------------------------------------------------------------

describe('getUserHash — null / undefined input', () => {
  it('returns undefined immediately for null userId', async () => {
    const result = await getUserHash(null);
    expect(result).toBeUndefined();
  });

  it('returns undefined immediately for undefined userId', async () => {
    const result = await getUserHash(undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined immediately for empty string userId', async () => {
    const result = await getUserHash('');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getUserHash — fetch mocking (Edge Function integration)
// ---------------------------------------------------------------------------

describe('getUserHash — Edge Function fetch', () => {
  it('calls the pseudonymize-user-id endpoint and returns the hash', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse('abc123'));
    vi.stubGlobal('fetch', mockFetch);

    // Provide VITE_SUPABASE_URL via import.meta.env simulation
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    const result = await getUserHash('user-uuid-1');
    expect(result).toBe('abc123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/functions/v1/pseudonymize-user-id');
    expect(JSON.parse(init.body as string)).toEqual({ userId: 'user-uuid-1' });
  });

  it('includes Authorization header when auth token is set', async () => {
    setAnalyticsAuthToken('my-jwt-token');
    const mockFetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse('deadbeef'));
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    await getUserHash('user-uuid-2');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('omits Authorization header when no auth token is set', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(makeSuccessResponse('cafebabe'));
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    await getUserHash('user-uuid-3');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('returns undefined when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    const result = await getUserHash('user-uuid-4');
    expect(result).toBeUndefined();
  });

  it('returns undefined when the Edge Function returns a non-200 status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(makeErrorResponse(401)));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    const result = await getUserHash('user-uuid-5');
    expect(result).toBeUndefined();
  });

  it('returns undefined when the response body has no hash field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'missing salt' }), { status: 200 }),
    ));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    const result = await getUserHash('user-uuid-6');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getUserHash — caching
// ---------------------------------------------------------------------------

describe('getUserHash — caching', () => {
  it('caches the result and calls fetch only once per userId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse('cached-hash'));
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    const [r1, r2] = await Promise.all([
      getUserHash('user-uuid-cache'),
      getUserHash('user-uuid-cache'),
    ]);

    expect(r1).toBe('cached-hash');
    expect(r2).toBe('cached-hash');
    // Both calls shared the same pending Promise — fetch called once.
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('clears the cache when clearAnalyticsCache is called', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeSuccessResponse('first-hash'))
      .mockResolvedValueOnce(makeSuccessResponse('second-hash'));
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    const first = await getUserHash('user-uuid-clear');
    expect(first).toBe('first-hash');

    clearAnalyticsCache();

    const second = await getUserHash('user-uuid-clear');
    expect(second).toBe('second-hash');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// setAnalyticsAuthToken
// ---------------------------------------------------------------------------

describe('setAnalyticsAuthToken', () => {
  it('updates the token used in subsequent requests', async () => {
    setAnalyticsAuthToken('token-v1');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeSuccessResponse('hash1'))
      .mockResolvedValueOnce(makeSuccessResponse('hash2'));
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    await getUserHash('user-a');
    clearAnalyticsCache();

    setAnalyticsAuthToken('token-v2');
    await getUserHash('user-a');

    const call1Headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    const call2Headers = mockFetch.mock.calls[1][1].headers as Record<string, string>;
    expect(call1Headers['Authorization']).toBe('Bearer token-v1');
    expect(call2Headers['Authorization']).toBe('Bearer token-v2');
  });

  it('removes the Authorization header when set to null', async () => {
    setAnalyticsAuthToken('token-before');

    const mockFetch = vi.fn().mockResolvedValue(makeSuccessResponse('any-hash'));
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

    setAnalyticsAuthToken(null);
    await getUserHash('user-b');

    const callHeaders = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(callHeaders['Authorization']).toBeUndefined();
  });
});
