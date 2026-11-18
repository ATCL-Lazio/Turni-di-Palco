// Tests for #1683 client hardening: duplicate token copy, promo URLs, log redaction, error overlay.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Session } from '@supabase/supabase-js';
import { sanitizePromoUrl } from '../lib/safe-external-url';
import { redactLogDetails } from '../state/offline-sync-log';
import { persistStoredSession, readStoredSession } from '../state/persistence';
import { SUPABASE_SESSION_ID_KEY, SUPABASE_SESSION_KEY, LEGACY_SUPABASE_SESSION_KEY } from '../lib/auth-storage';
import { getLocalAtclNewsTickerItems } from '../services/atcl-promotions';

describe('sanitizePromoUrl', () => {
  it('accepts https URLs on known hosts', () => {
    expect(sanitizePromoUrl('https://www.atcllazio.it/evento')).toBe('https://www.atcllazio.it/evento');
    expect(sanitizePromoUrl('https://spaziorossellini.it/x')).toBe('https://spaziorossellini.it/x');
  });

  it('rejects other schemes, hosts, lookalikes and garbage', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,hi',
      'http://www.atcllazio.it/',
      'https://evil.example/',
      'https://atcllazio.it.evil.example/',
      'https://evilatcllazio.it/',
      'https://user:pw@www.atcllazio.it/',
      'not a url',
      '',
      undefined,
      42,
    ]) {
      expect(sanitizePromoUrl(bad)).toBeUndefined();
    }
  });

  it('local ticker items only expose safe URLs', () => {
    for (const item of getLocalAtclNewsTickerItems(new Date('2026-03-01T00:00:00Z'))) {
      expect(sanitizePromoUrl(item.url)).toBe(item.url);
    }
  });
});

describe('redactLogDetails', () => {
  it('redacts sensitive keys recursively', () => {
    const out = redactLogDetails({
      access_token: 'abc',
      nested: { Authorization: 'Bearer xyz', password: 'p', ok: 1 },
      list: [{ refreshToken: 'r' }],
      email: 'a@b.it',
      keep: 'value',
    }) as { access_token: string; nested: Record<string, unknown>; list: Array<Record<string, unknown>>; email: string; keep: string };
    expect(out.access_token).toBe('[redacted]');
    expect(out.nested.Authorization).toBe('[redacted]');
    expect(out.nested.password).toBe('[redacted]');
    expect(out.nested.ok).toBe(1);
    expect(out.list[0].refreshToken).toBe('[redacted]');
    expect(out.email).toBe('[redacted]');
    expect(out.keep).toBe('value');
  });

  it('scrubs token-like and email-like substrings and errors', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJl';
    expect(redactLogDetails(`failed with ${jwt} for mario@example.com`)).toBe('failed with [redacted] for [redacted]');
    const err = redactLogDetails(new Error('Bearer abcdefgh12345678 rejected')) as { message: string };
    expect(err.message).toBe('Bearer [redacted] rejected');
  });

  it('handles cyclic-depth objects without throwing', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => redactLogDetails(a)).not.toThrow();
  });
});

describe('persistStoredSession / readStoredSession', () => {
  beforeEach(() => window.localStorage.clear());

  const session = { access_token: 'AT', refresh_token: 'RT', user: { id: 'u1' } } as unknown as Session;

  it('never stores access/refresh tokens, only the user id marker', () => {
    persistStoredSession(session);
    expect(window.localStorage.getItem(SUPABASE_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(SUPABASE_SESSION_ID_KEY)).toBe('u1');
    const dump = JSON.stringify({ ...window.localStorage });
    expect(dump).not.toContain('AT"');
    expect(dump).not.toContain('RT');
  });

  it('clears the marker on logout and removes leftover token copies', () => {
    window.localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }));
    persistStoredSession(session);
    expect(window.localStorage.getItem(SUPABASE_SESSION_KEY)).toBeNull();
    persistStoredSession(null);
    expect(window.localStorage.getItem(SUPABASE_SESSION_ID_KEY)).toBeNull();
  });

  it('readStoredSession returns a legacy copy once and removes it', () => {
    window.localStorage.setItem(
      LEGACY_SUPABASE_SESSION_KEY,
      JSON.stringify({ access_token: 'a', refresh_token: 'r', user_id: 'u1' })
    );
    expect(readStoredSession()).toMatchObject({ access_token: 'a', refresh_token: 'r' });
    expect(window.localStorage.getItem(LEGACY_SUPABASE_SESSION_KEY)).toBeNull();
    expect(readStoredSession()).toBeNull();
  });

  it('drops malformed legacy copies', () => {
    window.localStorage.setItem(SUPABASE_SESSION_KEY, '{not json');
    expect(readStoredSession()).toBeNull();
    expect(window.localStorage.getItem(SUPABASE_SESSION_KEY)).toBeNull();
  });
});

describe('ErrorOverlay', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('hides raw details in production builds', async () => {
    vi.stubEnv('DEV', false);
    const { ErrorOverlay } = await import('../components/ui/ErrorOverlay');
    const html = renderToStaticMarkup(<ErrorOverlay title="T" message="M" details="secret stack" onReload={() => {}} onHome={() => {}} />);
    expect(html).not.toContain('secret stack');
  });

  it('shows details in DEV', async () => {
    vi.stubEnv('DEV', true);
    const { ErrorOverlay } = await import('../components/ui/ErrorOverlay');
    const html = renderToStaticMarkup(<ErrorOverlay title="T" message="M" details="dev stack" onReload={() => {}} onHome={() => {}} />);
    expect(html).toContain('dev stack');
  });
});
