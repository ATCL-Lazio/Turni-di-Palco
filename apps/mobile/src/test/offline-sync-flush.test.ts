/**
 * Test di unità per il ciclo di flush della coda offline estratto da store.tsx.
 * Usa la coda reale su localStorage (jsdom): nessuna rete.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueExecutionResult } from '../state/offline-sync-executor';
import { flushOfflineQueue, getRefreshNeedsForMutation } from '../state/offline-sync-flush';
import {
  OFFLINE_SYNC_MAX_ATTEMPTS,
  readQueuedSupabaseMutations,
  writeQueuedSupabaseMutations,
} from '../state/offline-sync-queue';
import type { QueuedSupabaseMutation } from '../state/offline-sync-queue';

function mutation(id: string, overrides: Partial<QueuedSupabaseMutation> = {}): QueuedSupabaseMutation {
  return {
    id,
    userId: 'u1',
    createdAt: 0,
    attempts: 0,
    kind: 'mark_badges_seen',
    payload: { user_id: 'u1' },
    ...overrides,
  } as QueuedSupabaseMutation;
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

type Execute = (m: QueuedSupabaseMutation) => Promise<QueueExecutionResult>;

function deps(execute: ReturnType<typeof vi.fn<Execute>>, overrides = {}) {
  return {
    authUserId: 'u1',
    canSync: true,
    execute,
    onQueueChanged: vi.fn(),
    notifyError: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
  localStorage.clear();
});

describe('getRefreshNeedsForMutation', () => {
  it('chiede il refresh completo per turni, attività e reset', () => {
    for (const kind of ['turn_insert', 'turn_register', 'activity_insert', 'reset_progress'] as const) {
      expect(getRefreshNeedsForMutation(kind)).toEqual({ turnStats: true, theatreReputation: true, badges: true });
    }
  });

  it('mark_badges_seen aggiorna solo i badge; gli altri nulla', () => {
    expect(getRefreshNeedsForMutation('mark_badges_seen')).toEqual({ badges: true });
    expect(getRefreshNeedsForMutation('profile_upsert')).toEqual({});
  });
});

describe('flushOfflineQueue', () => {
  it('non parte senza prerequisiti, offline o con coda vuota', async () => {
    const execute = vi.fn<Execute>();
    writeQueuedSupabaseMutations([mutation('a')]);

    expect(await flushOfflineQueue(deps(execute, { canSync: false }))).toEqual({ ran: false });
    expect(await flushOfflineQueue(deps(execute, { authUserId: null }))).toEqual({ ran: false });
    setOnline(false);
    expect(await flushOfflineQueue(deps(execute))).toEqual({ ran: false });
    setOnline(true);
    localStorage.clear();
    expect(await flushOfflineQueue(deps(execute))).toEqual({ ran: false });
    expect(execute).not.toHaveBeenCalled();
  });

  it('ignora le mutazioni di altri utenti', async () => {
    const execute = vi.fn<Execute>();
    writeQueuedSupabaseMutations([mutation('a', { userId: 'u2' })]);
    expect(await flushOfflineQueue(deps(execute))).toEqual({ ran: false });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rimuove le mutazioni applicate o scartate e accumula i refresh', async () => {
    writeQueuedSupabaseMutations([
      mutation('a'),
      mutation('b', { kind: 'turn_register' }),
      mutation('other', { userId: 'u2' }),
    ]);
    const execute = vi
      .fn<Execute>()
      .mockResolvedValueOnce({ status: 'applied' })
      .mockResolvedValueOnce({ status: 'discard', error: new Error('no') });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const d = deps(execute);

    const result = await flushOfflineQueue(d);

    expect(result).toEqual({ ran: true, refresh: { turnStats: true, theatreReputation: true, badges: true } });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(readQueuedSupabaseMutations().map((m) => m.id)).toEqual(['other']);
    expect(d.onQueueChanged).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('su retry incrementa i tentativi e salva l\'ultimo errore', async () => {
    writeQueuedSupabaseMutations([mutation('a')]);
    const execute = vi.fn<Execute>().mockResolvedValue({ status: 'retry', error: new Error('rete') });

    const result = await flushOfflineQueue(deps(execute));

    expect(result).toEqual({ ran: true, refresh: { turnStats: false, theatreReputation: false, badges: false } });
    const [kept] = readQueuedSupabaseMutations();
    expect(kept.attempts).toBe(1);
    expect(kept.lastError).toContain('rete');
  });

  it('scarta e notifica dopo il numero massimo di tentativi', async () => {
    writeQueuedSupabaseMutations([mutation('a', { attempts: OFFLINE_SYNC_MAX_ATTEMPTS - 1 })]);
    const execute = vi.fn<Execute>().mockResolvedValue({ status: 'retry', error: new Error('rete') });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const d = deps(execute);

    await flushOfflineQueue(d);

    expect(readQueuedSupabaseMutations()).toEqual([]);
    expect(d.notifyError).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('se la rete cade a metà non tocca i tentativi delle mutazioni rimaste (#1379)', async () => {
    writeQueuedSupabaseMutations([mutation('a'), mutation('b')]);
    const execute = vi.fn<Execute>().mockImplementation(async () => {
      setOnline(false);
      return { status: 'applied' };
    });

    await flushOfflineQueue(deps(execute));

    expect(execute).toHaveBeenCalledTimes(1);
    const [left] = readQueuedSupabaseMutations();
    expect(left.id).toBe('b');
    expect(left.attempts).toBe(0);
  });
});
