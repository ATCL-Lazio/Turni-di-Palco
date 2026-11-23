import { useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logOfflineSync } from '../offline-sync-log';
import {
  OFFLINE_SYNC_BASE_RETRY_INTERVAL_MS,
  getOfflineSyncRetryDelayMs,
  readQueuedSupabaseMutations,
} from '../offline-sync-queue';

/**
 * Svuota la coda delle mutazioni offline quando la sessione è pronta, quando
 * il browser torna online e periodicamente con backoff esponenziale.
 */
export function useOfflineSyncRetryLoop(
  authUserId: string | null,
  flushQueuedSupabaseMutations: () => Promise<void>,
): void {
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;
    logOfflineSync('Auth session ready: checking queued mutations', { authUserId });
    void flushQueuedSupabaseMutations();
  }, [authUserId, flushQueuedSupabaseMutations]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;
    if (typeof window === 'undefined') return;
    logOfflineSync('Online/offline sync listeners started', {
      authUserId,
      baseRetryIntervalMs: OFFLINE_SYNC_BASE_RETRY_INTERVAL_MS,
    });

    const handleOnline = () => {
      logOfflineSync('Browser online event: retrying queued mutations', { authUserId });
      void flushQueuedSupabaseMutations();
    };

    window.addEventListener('online', handleOnline);

    // Use a setTimeout-based loop so the delay between retries scales with the
    // number of attempts already made (exponential backoff via getOfflineSyncRetryDelayMs),
    // instead of always waiting the fixed OFFLINE_SYNC_BASE_RETRY_INTERVAL_MS.
    let timeoutId: number | null = null;
    let cancelled = false;

    const scheduleNextTick = () => {
      if (cancelled) return;
      const queuedForUser = readQueuedSupabaseMutations().filter(
        (entry) => entry.userId === authUserId
      );
      const maxAttempts = queuedForUser.reduce(
        (max, entry) => Math.max(max, entry.attempts ?? 0),
        0
      );
      const delay = getOfflineSyncRetryDelayMs(maxAttempts);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        const hasQueuedForUser = readQueuedSupabaseMutations().some(
          (entry) => entry.userId === authUserId
        );
        if (hasQueuedForUser) {
          logOfflineSync('Periodic retry tick: queued mutations detected', { authUserId, delay });
          void flushQueuedSupabaseMutations();
        }
        scheduleNextTick();
      }, delay);
    };

    scheduleNextTick();

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      logOfflineSync('Online/offline sync listeners stopped', { authUserId });
    };
  }, [authUserId, flushQueuedSupabaseMutations]);
}
