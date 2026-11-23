import { useCallback, useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  OFFLINE_SYNC_LOG_PREFIX,
  OFFLINE_SYNC_SERVER_LOG_BATCH_SIZE,
  OFFLINE_SYNC_SERVER_LOG_FUNCTION,
  OFFLINE_SYNC_SERVER_LOG_RETRY_INTERVAL_MS,
  readMirroredClientLogs,
  shouldMirrorOfflineSyncLogsToServer,
  writeMirroredClientLogs,
} from '../offline-sync-log';
import { isNavigatorOffline } from '../offline-sync-queue';

/**
 * Inoltra a batch al server i log di sync offline salvati in locale, al
 * login, al ritorno online e a intervalli regolari.
 */
export function useServerLogMirror(authUserId: string | null, authReady: boolean): void {
  const offlineServerLogSyncInFlightRef = useRef(false);

  const flushMirroredClientLogsToServer = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !shouldMirrorOfflineSyncLogsToServer()) return;
    if (!authUserId) return;
    if (offlineServerLogSyncInFlightRef.current) return;
    if (isNavigatorOffline()) return;

    const queue = readMirroredClientLogs();
    if (!queue.length) return;

    const batch = queue.slice(0, OFFLINE_SYNC_SERVER_LOG_BATCH_SIZE);
    offlineServerLogSyncInFlightRef.current = true;
    if (import.meta.env.DEV) console.info(`${OFFLINE_SYNC_LOG_PREFIX} Mirroring log batch to server`, {
      batchSize: batch.length,
      queueSize: queue.length,
      duplicatePolicy: 'include',
    });

    try {
      const { data, error } = await supabase.functions.invoke(OFFLINE_SYNC_SERVER_LOG_FUNCTION, {
        body: {
          action: 'ingest_logs',
          source: 'mobile-offline-sync',
          duplicatePolicy: 'include',
          clientUserId: authUserId ?? null,
          logs: batch,
        },
      });

      if (error) {
        console.warn(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror failed`, {
          message: error.message,
          batchSize: batch.length,
        });
        return;
      }

      const acknowledgedIds = Array.isArray((data as { acceptedLogIds?: unknown })?.acceptedLogIds)
        ? ((data as { acceptedLogIds?: unknown[] }).acceptedLogIds ?? [])
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : batch.map((entry) => entry.id);
      const acknowledgedSet = new Set(acknowledgedIds);
      const remaining = readMirroredClientLogs().filter((entry) => !acknowledgedSet.has(entry.id));
      writeMirroredClientLogs(remaining);
      if (import.meta.env.DEV) console.info(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror ack`, {
        acknowledged: acknowledgedSet.size,
        remaining: remaining.length,
      });
    } catch (error) {
      console.warn(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror exception`, error);
    } finally {
      offlineServerLogSyncInFlightRef.current = false;
    }
  }, [authUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !shouldMirrorOfflineSyncLogsToServer()) return;
    void flushMirroredClientLogsToServer();
  }, [authUserId, authReady, flushMirroredClientLogsToServer]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !shouldMirrorOfflineSyncLogsToServer()) return;
    if (typeof window === 'undefined') return;
    if (import.meta.env.DEV) console.info(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror listeners started`, {
      retryIntervalMs: OFFLINE_SYNC_SERVER_LOG_RETRY_INTERVAL_MS,
      batchSize: OFFLINE_SYNC_SERVER_LOG_BATCH_SIZE,
    });

    const handleOnline = () => {
      if (import.meta.env.DEV) console.info(`${OFFLINE_SYNC_LOG_PREFIX} Browser online: retrying server log mirror`);
      void flushMirroredClientLogsToServer();
    };

    window.addEventListener('online', handleOnline);
    const intervalId = window.setInterval(
      () => void flushMirroredClientLogsToServer(),
      OFFLINE_SYNC_SERVER_LOG_RETRY_INTERVAL_MS
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.clearInterval(intervalId);
      if (import.meta.env.DEV) console.info(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror listeners stopped`);
    };
  }, [flushMirroredClientLogsToServer]);
}
