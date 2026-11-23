/**
 * Ciclo di svuotamento della coda offline, estratto da store.tsx.
 * Non conosce React: le dipendenze (esecuzione, refresh del contatore boost,
 * notifica errori) arrivano da `FlushDeps`, il resto passa dalla coda su storage.
 */

import { formatSyncError, notifyCriticalError } from './errors';
import { logOfflineSync } from './offline-sync-log';
import {
  OFFLINE_SYNC_MAX_ATTEMPTS,
  isNavigatorOffline,
  readQueuedSupabaseMutations,
  summarizeQueuedMutation,
  writeQueuedSupabaseMutations,
} from './offline-sync-queue';
import type { QueuedSupabaseMutation } from './offline-sync-queue';
import type { QueueExecutionResult } from './offline-sync-executor';

export type FlushRefreshNeeds = {
  turnStats: boolean;
  theatreReputation: boolean;
  badges: boolean;
};

export type FlushDeps = {
  authUserId: string | null | undefined;
  /** false se Supabase non è configurato o il client manca. */
  canSync: boolean;
  execute: (mutation: QueuedSupabaseMutation) => Promise<QueueExecutionResult>;
  onQueueChanged: (queue: QueuedSupabaseMutation[]) => void;
  notifyError?: (message: string, errors: unknown[]) => void;
};

export type FlushResult =
  | { ran: false }
  | { ran: true; refresh: FlushRefreshNeeds };

const REFRESH_ALL_KINDS: ReadonlySet<QueuedSupabaseMutation['kind']> = new Set([
  'turn_insert',
  'turn_register',
  'activity_insert',
  'reset_progress',
]);

/** Quali viste derivate vanno ricaricate dopo che una mutazione è stata chiusa. */
export function getRefreshNeedsForMutation(kind: QueuedSupabaseMutation['kind']): Partial<FlushRefreshNeeds> {
  if (REFRESH_ALL_KINDS.has(kind)) return { turnStats: true, theatreReputation: true, badges: true };
  if (kind === 'mark_badges_seen') return { badges: true };
  return {};
}

/**
 * Verifica i prerequisiti e restituisce la coda da processare,
 * oppure null (con log) se non c'è nulla da fare.
 */
function readQueueToFlush(deps: FlushDeps): QueuedSupabaseMutation[] | null {
  const { authUserId, canSync } = deps;
  if (!canSync || !authUserId) {
    logOfflineSync('Flush skipped: missing prerequisites', { canSync, authUserId });
    return null;
  }
  if (isNavigatorOffline()) {
    logOfflineSync('Flush skipped: browser offline');
    return null;
  }
  const queue = readQueuedSupabaseMutations();
  if (!queue.length) {
    logOfflineSync('Flush skipped: queue empty');
    return null;
  }
  const queuedForUser = queue.filter((entry) => entry.userId === authUserId).length;
  if (!queuedForUser) {
    logOfflineSync('Flush skipped: no queued mutations for active user', {
      authUserId,
      queueSize: queue.length,
    });
    return null;
  }
  logOfflineSync('Flush started', { authUserId, queuedForUser, queueSize: queue.length });
  return queue;
}

export async function flushOfflineQueue(deps: FlushDeps): Promise<FlushResult> {
  const { authUserId, execute, onQueueChanged } = deps;
  const notifyError = deps.notifyError ?? notifyCriticalError;

  let queue = readQueueToFlush(deps);
  if (!queue) return { ran: false };

  const refresh: FlushRefreshNeeds = { turnStats: false, theatreReputation: false, badges: false };
  const persist = (next: QueuedSupabaseMutation[]) => {
    queue = next;
    writeQueuedSupabaseMutations(next);
    onQueueChanged(next);
  };

  try {
    for (const queuedMutation of [...queue]) {
      // Ricontrolla la connessione a ogni giro: un calo di rete a metà flush
      // non deve incrementare i tentativi di tutte le mutazioni rimaste e
      // farle scartare per un problema transitorio (closes #1379).
      if (isNavigatorOffline()) {
        logOfflineSync('Flush aborted mid-loop: browser went offline', {
          authUserId,
          remainingForUser: queue.filter((entry) => entry.userId === authUserId).length,
        }, 'warn');
        break;
      }

      if (queuedMutation.userId !== authUserId) continue;
      if (!queue.some((entry) => entry.id === queuedMutation.id)) continue;
      logOfflineSync('Processing queued mutation', summarizeQueuedMutation(queuedMutation));

      const result = await execute(queuedMutation);
      if (result.status === 'applied' || result.status === 'discard') {
        persist(readQueuedSupabaseMutations().filter((entry) => entry.id !== queuedMutation.id));
        logOfflineSync(
          result.status === 'applied' ? 'Mutation synced successfully' : 'Mutation discarded (non retryable)',
          {
            mutation: summarizeQueuedMutation(queuedMutation),
            error: result.error ? formatSyncError(result.error) : undefined,
            queueSize: queue.length,
          }
        );

        const needs = getRefreshNeedsForMutation(queuedMutation.kind);
        refresh.turnStats ||= Boolean(needs.turnStats);
        refresh.theatreReputation ||= Boolean(needs.theatreReputation);
        refresh.badges ||= Boolean(needs.badges);

        if (result.status === 'discard' && result.error) {
          console.warn('Offline sync dropped mutation', queuedMutation.kind, formatSyncError(result.error));
        }
        continue;
      }

      persist(
        readQueuedSupabaseMutations().map((entry) =>
          entry.id === queuedMutation.id
            ? { ...entry, attempts: entry.attempts + 1, lastError: formatSyncError(result.error) }
            : entry
        )
      );

      const updatedMutation = queue.find((entry) => entry.id === queuedMutation.id);
      logOfflineSync('Mutation retry scheduled', {
        mutation: summarizeQueuedMutation(updatedMutation ?? queuedMutation),
        error: formatSyncError(result.error),
      });
      if (updatedMutation && updatedMutation.attempts >= OFFLINE_SYNC_MAX_ATTEMPTS) {
        persist(readQueuedSupabaseMutations().filter((entry) => entry.id !== queuedMutation.id));
        logOfflineSync('Mutation dropped after max retry attempts', {
          mutation: summarizeQueuedMutation(updatedMutation),
          queueSize: queue.length,
        });
        console.warn(
          'Offline sync dropped mutation after max attempts',
          updatedMutation.kind,
          updatedMutation.lastError
        );
        notifyError('Alcune operazioni offline non sono sincronizzabili.', [
          updatedMutation.lastError ?? result.error,
        ]);
      }
    }
  } finally {
    onQueueChanged(queue);
    logOfflineSync('Flush completed', {
      authUserId,
      remainingForUser: queue.filter((entry) => entry.userId === authUserId).length,
      queueSize: queue.length,
    });
  }

  return { ran: true, refresh };
}
