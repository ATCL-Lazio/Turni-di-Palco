/**
 * Test di unità per l'esecuzione delle mutazioni offline estratta da store.tsx.
 * Usa un client Supabase finto: nessuna rete.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { executeQueuedMutation } from '../state/offline-sync-executor';
import type { QueuedSupabaseMutation, TurnRegisterPayload } from '../state/offline-sync-queue';

type RpcResult = { data?: unknown; error?: unknown };

function fakeClient(rpcResult: RpcResult = { data: null, error: null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const upsert = vi.fn().mockResolvedValue({ error: rpcResult.error ?? null });
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, upsert };
}

const base = { id: 'm1', userId: 'u1', createdAt: 0, attempts: 0 };

const turnPayload: TurnRegisterPayload = {
  id: 'client-action-1',
  user_id: 'u1',
  event_id: 'e1',
  event_name: 'Amleto',
  theatre: 'Argentina',
  event_date: '2026-12-01',
  event_time: '21:00',
  role_id: 'luci',
  boost_requested: true,
  sync_status: 'pending',
  checkin_latitude: 41.9,
  checkin_longitude: 12.5,
};

const turnMutation: QueuedSupabaseMutation = { ...base, kind: 'turn_register', payload: turnPayload };

describe('executeQueuedMutation', () => {
  it('ritenta se il client Supabase non è configurato', async () => {
    const result = await executeQueuedMutation(null, turnMutation, vi.fn());
    expect(result.status).toBe('retry');
  });

  it('turn_register: chiama la RPC e notifica il risultato', async () => {
    const { client, rpc } = fakeClient({
      data: [{ turn_registered: true, boost_requested: true, boost_applied: true, rewards_applied: { xp: 10 } }],
    });
    const onTurnRegistered = vi.fn();

    const result = await executeQueuedMutation(client, turnMutation, onTurnRegistered);

    expect(result).toEqual({ status: 'applied' });
    expect(rpc).toHaveBeenCalledWith('register_turn_with_token_boost', {
      p_event_id: 'e1',
      p_role_id: 'luci',
      p_client_action_id: 'client-action-1',
      p_boost_requested: true,
      p_checkin_latitude: 41.9,
      p_checkin_longitude: 12.5,
      p_checkin_accuracy_m: null,
    });
    expect(onTurnRegistered).toHaveBeenCalledTimes(1);
    const [payload, rpcRow, syncStatus, geolocationAvailable] = onTurnRegistered.mock.calls[0];
    expect(payload).toBe(turnPayload);
    expect(rpcRow.turn_registered).toBe(true);
    expect(syncStatus).toBe('synced');
    expect(geolocationAvailable).toBe(true);
  });

  it('turn_register: una risposta RPC non valida viene ritentata', async () => {
    const { client } = fakeClient({ data: 'boh' });
    const onTurnRegistered = vi.fn();
    const result = await executeQueuedMutation(client, turnMutation, onTurnRegistered);
    expect(result.status).toBe('retry');
    expect(onTurnRegistered).not.toHaveBeenCalled();
  });

  it('turn_register: un errore permanente viene scartato con messaggio localizzato', async () => {
    const { client } = fakeClient({ error: { status: 403, message: 'forbidden' } });
    const result = await executeQueuedMutation(client, turnMutation, vi.fn());
    expect(result.status).toBe('discard');
    expect(result.error).toBeInstanceOf(Error);
  });

  it('un errore di rete transitorio viene ritentato', async () => {
    const { client } = fakeClient({ error: { status: 503, message: 'service unavailable' } });
    const result = await executeQueuedMutation(client, turnMutation, vi.fn());
    expect(result.status).toBe('retry');
  });

  it('un errore duplicato su follow_event_insert conta come applicato', async () => {
    const { client } = fakeClient({ error: { code: '23505', message: 'duplicate key' } });
    const mutation: QueuedSupabaseMutation = {
      ...base,
      kind: 'follow_event_insert',
      payload: { user_id: 'u1', event_id: 'e1', planned_role_id: 'luci', planning_status: 'planned' },
    };
    expect((await executeQueuedMutation(client, mutation, vi.fn())).status).toBe('applied');
  });

  it('profile_upsert usa upsert su profiles con onConflict id', async () => {
    const { client, from, upsert } = fakeClient();
    const payload = { id: 'u1', name: 'Mario' } as never;
    const result = await executeQueuedMutation(client, { ...base, kind: 'profile_upsert', payload }, vi.fn());
    expect(result.status).toBe('applied');
    expect(from).toHaveBeenCalledWith('profiles');
    expect(upsert).toHaveBeenCalledWith(payload, { onConflict: 'id' });
  });

  it.each([
    ['mark_badges_seen', 'mark_my_badges_seen'],
    ['reset_progress', 'reset_my_progress'],
  ] as const)('%s chiama la RPC %s', async (kind, rpcName) => {
    const { client, rpc } = fakeClient();
    const mutation = { ...base, kind, payload: { user_id: 'u1' } } as QueuedSupabaseMutation;
    expect((await executeQueuedMutation(client, mutation, vi.fn())).status).toBe('applied');
    expect(rpc).toHaveBeenCalledWith(rpcName);
  });

  it('follow_event_delete chiama remove_planned_participation', async () => {
    const { client, rpc } = fakeClient();
    const mutation: QueuedSupabaseMutation = {
      ...base,
      kind: 'follow_event_delete',
      payload: { user_id: 'u1', event_id: 'e9', planned_role_id: 'luci', planning_status: 'planned' },
    };
    await executeQueuedMutation(client, mutation, vi.fn());
    expect(rpc).toHaveBeenCalledWith('remove_planned_participation', { p_event_id: 'e9' });
  });

  it('un kind sconosciuto viene scartato', async () => {
    const { client } = fakeClient();
    const mutation = { ...base, kind: 'qualcosa_di_vecchio', payload: {} } as unknown as QueuedSupabaseMutation;
    expect((await executeQueuedMutation(client, mutation, vi.fn())).status).toBe('discard');
  });
});
