/**
 * Esecuzione di una singola mutazione della coda offline verso Supabase,
 * estratta da store.tsx. Non conosce React: gli effetti sullo stato locale
 * passano dalla callback `onTurnRegistered`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isDuplicateSyncError, localizeTurnRegistrationError, shouldRetrySyncError } from './errors';
import type { QueuedSupabaseMutation, TurnRegisterPayload } from './offline-sync-queue';
import {
  parseActivityCompletionRpcRow,
  parseTurnRegistrationRpcRow,
  resolveTurnSyncStatusFromRpc,
  type TurnRegistrationRpcRow,
} from './supabase-mappers';
import type { TurnSyncStatus } from './types';

export type QueueExecutionResult = { status: 'applied' | 'retry' | 'discard'; error?: unknown };

export type TurnRegisteredHandler = (
  payload: TurnRegisterPayload,
  rpcRow: TurnRegistrationRpcRow,
  syncStatus: TurnSyncStatus,
  geolocationAvailable?: boolean,
) => void;

/**
 * Esegue `mutation` e ne classifica l'esito: `applied` (da rimuovere dalla
 * coda), `retry` (errore transitorio) o `discard` (errore non recuperabile).
 */
export async function executeQueuedMutation(
  client: SupabaseClient | null,
  mutation: QueuedSupabaseMutation,
  onTurnRegistered: TurnRegisteredHandler,
): Promise<QueueExecutionResult> {
  if (!client) {
    return { status: 'retry', error: new Error('Supabase non configurato') };
  }

  try {
    if (mutation.kind === 'profile_upsert') {
      const { error } = await client
        .from('profiles')
        .upsert(mutation.payload, { onConflict: 'id' });
      if (!error) return { status: 'applied' };
      return shouldRetrySyncError(error)
        ? { status: 'retry', error }
        : { status: 'discard', error };
    }

    if (mutation.kind === 'turn_insert') {
      // Kind legacy (code persistito da versioni precedenti): le scritture dirette
      // su `turns` non sono piu' consentite ai client, quindi passa dalla RPC che
      // calcola le ricompense lato server ed e' idempotente su p_client_action_id.
      const { error } = await client.rpc('register_turn_with_token_boost', {
        p_event_id: mutation.payload.event_id,
        p_role_id: mutation.payload.role_id,
        p_client_action_id: mutation.payload.id,
        p_boost_requested: false,
        p_checkin_latitude: null,
        p_checkin_longitude: null,
        p_checkin_accuracy_m: null,
      });
      if (!error || isDuplicateSyncError(error)) return { status: 'applied' };
      return shouldRetrySyncError(error)
        ? { status: 'retry', error }
        : { status: 'discard', error };
    }

    if (mutation.kind === 'turn_register') {
      const { data, error } = await client.rpc('register_turn_with_token_boost', {
        p_event_id: mutation.payload.event_id,
        p_role_id: mutation.payload.role_id,
        p_client_action_id: mutation.payload.id,
        p_boost_requested: mutation.payload.boost_requested,
        p_checkin_latitude: mutation.payload.checkin_latitude ?? null,
        p_checkin_longitude: mutation.payload.checkin_longitude ?? null,
        p_checkin_accuracy_m: mutation.payload.checkin_accuracy_m ?? null,
      });
      if (error) {
        return shouldRetrySyncError(error)
          ? { status: 'retry', error }
          : { status: 'discard', error: new Error(localizeTurnRegistrationError(error)) };
      }
      const rpcRow = parseTurnRegistrationRpcRow(data);
      if (!rpcRow) {
        return { status: 'retry', error: new Error('Risposta RPC non valida') };
      }
      const syncStatus = resolveTurnSyncStatusFromRpc(rpcRow);
      onTurnRegistered(mutation.payload, rpcRow, syncStatus, Boolean(mutation.payload.checkin_latitude && mutation.payload.checkin_longitude));
      return { status: 'applied' };
    }

    if (mutation.kind === 'activity_insert') {
      const { data, error } = await client.rpc('complete_activity_with_slots', {
        p_activity_id: mutation.payload.activity_id,
        p_client_action_id: mutation.payload.id,
        p_score: mutation.payload.score ?? null,
        p_rating: mutation.payload.rating ?? null,
        p_attempts: mutation.payload.attempts ?? 1,
        p_duration_ms: mutation.payload.duration_ms ?? null,
      });
      if (error) {
        return shouldRetrySyncError(error)
          ? { status: 'retry', error }
          : { status: 'discard', error };
      }
      const rpcRow = parseActivityCompletionRpcRow(data);
      if (!rpcRow) {
        return { status: 'retry', error: new Error('Risposta complete_activity_with_slots non valida') };
      }
      return { status: 'applied' };
    }

    if (mutation.kind === 'follow_event_insert') {
      const { error } = await client.rpc('upsert_planned_participation', {
        p_event_id: mutation.payload.event_id,
        p_role_id: mutation.payload.planned_role_id,
        p_status: mutation.payload.planning_status,
        p_notes: null,
      });
      if (!error || isDuplicateSyncError(error)) return { status: 'applied' };
      return shouldRetrySyncError(error)
        ? { status: 'retry', error }
        : { status: 'discard', error };
    }

    if (mutation.kind === 'follow_event_delete') {
      const { error } = await client.rpc('remove_planned_participation', {
        p_event_id: mutation.payload.event_id,
      });
      if (!error) return { status: 'applied' };
      return shouldRetrySyncError(error)
        ? { status: 'retry', error }
        : { status: 'discard', error };
    }

    if (mutation.kind === 'mark_badges_seen') {
      const { error } = await client.rpc('mark_my_badges_seen');
      if (!error) return { status: 'applied' };
      return shouldRetrySyncError(error)
        ? { status: 'retry', error }
        : { status: 'discard', error };
    }

    if (mutation.kind === 'reset_progress') {
      const { error } = await client.rpc('reset_my_progress');
      if (!error) return { status: 'applied' };
      return shouldRetrySyncError(error)
        ? { status: 'retry', error }
        : { status: 'discard', error };
    }

    return { status: 'discard' };
  } catch (error) {
    return shouldRetrySyncError(error)
      ? { status: 'retry', error }
      : { status: 'discard', error };
  }
}
