import { isSupabaseConfigured } from '../lib/supabase';
import { isRecord } from './normalizers';
import { createOfflineMutationId } from './offline-mutation-id';

// Separate storage key for server log events queued for upload.
// Kept distinct from the main data queue so that logging policies can evolve independently.
export const OFFLINE_SYNC_SERVER_LOG_QUEUE_KEY = 'tdp-mobile-offline-sync-server-logs-v1';

// Number of log items sent per batch to the logging endpoint.
// 60 strikes a balance between request overhead (fewer, larger batches) and
// memory/CPU usage on low‑end devices (smaller payloads).
export const OFFLINE_SYNC_SERVER_LOG_BATCH_SIZE = 60;

// Hard cap on how many log items we retain offline.
// 2500 is enough for diagnostics across long offline periods while preventing
// unbounded growth of log storage and very large upload bursts.
const OFFLINE_SYNC_SERVER_LOG_MAX_ITEMS = 2500;

// Retry interval for log uploads; shorter than data sync to reduce time‑to‑insight
// for production issues, but still conservative to avoid hammering the backend.
export const OFFLINE_SYNC_SERVER_LOG_RETRY_INTERVAL_MS = 8000;

// Supabase edge function used to receive mobile client logs.
// Kept as a constant so that changing the function name is centralized.
export const OFFLINE_SYNC_SERVER_LOG_FUNCTION = 'mobile-logs';

// Feature flag that enables mirroring of offline logs to an additional backend.
// Controlled by environment so that log mirroring can be toggled per deployment.
const OFFLINE_SYNC_SERVER_LOG_MIRROR_ENV =
  import.meta.env.VITE_OFFLINE_SYNC_SERVER_LOG_MIRROR_ENABLED;

// Hostname pattern used to identify preview environments where server log behavior
// may differ (e.g., additional logging or relaxed limits).
const OFFLINE_SYNC_SERVER_LOG_PREVIEW_HOST_RE =
  /^turni-di-palco-pr-\d+\.onrender\.com$|^turni-di-palco-git-.+\.vercel\.app$/i;

// Common prefix for all offline sync–related log messages to make them easy to filter.
export const OFFLINE_SYNC_LOG_PREFIX = '[TDP Offline Sync]';

type MirroredClientLogEntry = {
  id: string;
  sequence: number;
  createdAt: number;
  level: OfflineSyncLogLevel;
  message: string;
  details?: unknown;
};

type OfflineSyncLogLevel = 'info' | 'warn' | 'error';
let mirroredLogSequence = 0;

function normalizeMirroredLogLevel(value: unknown): OfflineSyncLogLevel {
  if (value === 'warn' || value === 'error' || value === 'info') return value;
  return 'info';
}

function serializeMirroredLogDetails(details: unknown): unknown {
  if (details == null) return undefined;
  if (typeof details === 'string' || typeof details === 'number' || typeof details === 'boolean') {
    return details;
  }
  if (details instanceof Error) {
    return {
      name: details.name,
      message: details.message,
      stack: details.stack ?? null,
    };
  }
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return String(details);
  }
}

export function readMirroredClientLogs(): MirroredClientLogEntry[] {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !shouldMirrorOfflineSyncLogsToServer()) return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_SYNC_SERVER_LOG_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry, index) => {
        const id = typeof entry.id === 'string' && entry.id.trim()
          ? entry.id.trim()
          : createOfflineMutationId();
        const message = typeof entry.message === 'string'
          ? entry.message.trim()
          : '';
        const createdAt = typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
          ? entry.createdAt
          : Date.now();
        const sequence = typeof entry.sequence === 'number' && Number.isFinite(entry.sequence)
          ? entry.sequence
          : index + 1;
        return {
          id,
          message,
          createdAt,
          sequence,
          level: normalizeMirroredLogLevel(entry.level),
          details: entry.details,
        };
      })
      .filter((entry) => entry.message)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-OFFLINE_SYNC_SERVER_LOG_MAX_ITEMS);
  } catch {
    return [];
  }
}

export function writeMirroredClientLogs(queue: MirroredClientLogEntry[]) {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !shouldMirrorOfflineSyncLogsToServer()) return;
  try {
    if (!queue.length) {
      window.localStorage.removeItem(OFFLINE_SYNC_SERVER_LOG_QUEUE_KEY);
      return;
    }
    window.localStorage.setItem(
      OFFLINE_SYNC_SERVER_LOG_QUEUE_KEY,
      JSON.stringify(queue.slice(-OFFLINE_SYNC_SERVER_LOG_MAX_ITEMS))
    );
  } catch {
    // keep best effort and avoid log recursion
  }
}

function enqueueMirroredClientLog(message: string, level: OfflineSyncLogLevel, details?: unknown) {
  if (typeof window === 'undefined' || !isSupabaseConfigured || !shouldMirrorOfflineSyncLogsToServer()) return;
  const trimmedMessage = message.trim();
  if (!trimmedMessage) return;
  const queue = readMirroredClientLogs();
  mirroredLogSequence += 1;
  queue.push({
    id: createOfflineMutationId(),
    sequence: mirroredLogSequence,
    createdAt: Date.now(),
    level,
    message: trimmedMessage,
    details: serializeMirroredLogDetails(details),
  });
  writeMirroredClientLogs(queue);
}

export function logOfflineSync(message: string, details?: unknown, level: OfflineSyncLogLevel = 'info') {
  const formattedMessage = `${OFFLINE_SYNC_LOG_PREFIX} ${new Date().toISOString()} ${message}`;
  if (level === 'warn') {
    if (details === undefined) console.warn(formattedMessage);
    else console.warn(formattedMessage, details);
  } else if (level === 'error') {
    if (details === undefined) console.error(formattedMessage);
    else console.error(formattedMessage, details);
  } else if (import.meta.env.DEV) {
    if (details === undefined) console.info(formattedMessage);
    else console.info(formattedMessage, details);
  }
  enqueueMirroredClientLog(message, level, details);
}

function parseOptionalBooleanEnv(value: unknown): boolean | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

export function shouldMirrorOfflineSyncLogsToServer() {
  const envOverride = parseOptionalBooleanEnv(OFFLINE_SYNC_SERVER_LOG_MIRROR_ENV);
  if (envOverride !== null) return envOverride;
  if (typeof window === 'undefined') return true;
  return !OFFLINE_SYNC_SERVER_LOG_PREVIEW_HOST_RE.test(window.location.hostname);
}
