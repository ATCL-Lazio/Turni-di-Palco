import type { RoleId, Rewards, TurnSyncStatus, EventPlanningStatus } from './types';
import { isRecord } from './normalizers';
import { createOfflineMutationId } from './offline-mutation-id';
import { logOfflineSync } from './offline-sync-log';

// Key used to persist the client‑side offline sync queue in storage. Version suffix (`v1`)
// allows us to invalidate incompatible queue formats by bumping the version.
export const OFFLINE_SYNC_QUEUE_KEY = 'tdp-mobile-offline-sync-v1';


// Base delay between retry attempts when flushing the offline sync queue.
// 15 seconds is a compromise between user‑perceived latency (shorter is better)
// and avoiding excessive battery and network usage on poor/unstable connections.
export const OFFLINE_SYNC_BASE_RETRY_INTERVAL_MS = 15000;

// Maximum delay between retry attempts when using exponential backoff.
// 60 seconds caps the backoff to avoid excessively long waits once connectivity is restored.
const OFFLINE_SYNC_MAX_RETRY_INTERVAL_MS = 60000;

/**
 * Computes the delay, in milliseconds, before the next offline sync retry.
 * Uses exponential backoff capped at OFFLINE_SYNC_MAX_RETRY_INTERVAL_MS.
 *
 * @param attemptCount Zero‑based retry attempt count (0 for the first retry).
 */
export function getOfflineSyncRetryDelayMs(attemptCount: number): number {
  if (attemptCount <= 0) {
    return OFFLINE_SYNC_BASE_RETRY_INTERVAL_MS;
  }
  const delay = OFFLINE_SYNC_BASE_RETRY_INTERVAL_MS * Math.pow(2, attemptCount);
  return Math.min(delay, OFFLINE_SYNC_MAX_RETRY_INTERVAL_MS);
}

// Upper bound on how many pending items we keep in the offline queue.
// 300 items is large enough to cover typical offline sessions, but small enough
// to avoid unbounded local storage usage and large burst uploads when connectivity returns.
const OFFLINE_SYNC_MAX_ITEMS = 300;

// Maximum number of retry attempts per item before we give up.
// 12 attempts at 15 s intervals ~= 3 minutes total retry window, which is long enough
// to ride out short outages without keeping failing items around indefinitely.
export const OFFLINE_SYNC_MAX_ATTEMPTS = 12;

const QUEUED_MUTATION_KINDS = [
  'profile_upsert',
  'turn_insert',
  'turn_register',
  'activity_insert',
  'follow_event_insert',
  'follow_event_delete',
  'mark_badges_seen',
  'reset_progress',
] as const;

type QueuedMutationKind = (typeof QUEUED_MUTATION_KINDS)[number];

export type ProfileUpsertPayload = {
  id: string;
  name: string;
  email: string;
  role_id: RoleId;
  profile_image?: string | null;
  leaderboard_visible?: boolean;
  cookie_consent_at?: string | null;
  onboarding_completed_at?: string | null;
  onboarding_variant?: 'full' | 'skipped_qr' | 'skipped_manual' | null;
  // Course state — Issue #327. Persisted as JSONB via migration 20260525000000.
  skills?: Record<string, number>;
  active_courses?: Record<string, string>;
  completed_courses?: Record<string, string>;
};

type TurnInsertPayload = {
  id: string;
  user_id: string;
  event_id: string;
  event_name: string;
  theatre: string;
  event_date: string;
  event_time: string;
  role_id: RoleId;
  rewards: Rewards;
};

export type TurnRegisterPayload = {
  id: string;
  user_id: string;
  event_id: string;
  event_name: string;
  theatre: string;
  event_date: string;
  event_time: string;
  role_id: RoleId;
  boost_requested: boolean;
  sync_status: TurnSyncStatus;
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  checkin_accuracy_m?: number | null;
};

type TurnGeolocationSnapshot = {
  latitude: number;
  longitude: number;
  accuracyM: number;
};

type ActivityInsertPayload = {
  id: string;
  user_id: string;
  activity_id: string;
  rewards: Rewards;
  // Optional telemetry fields — included when the activity was queued online
  // and replayed during offline-sync flush. Missing fields default to null/1
  // on the server, but omitting them loses telemetry entirely (closes #1129).
  score?: number | null;
  rating?: string | null;
  attempts?: number | null;
  duration_ms?: number | null;
};

type FollowEventMutationPayload = {
  user_id: string;
  event_id: string;
  planned_role_id: RoleId;
  planning_status: EventPlanningStatus;
};

type QueueBase = {
  id: string;
  userId: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type QueuedSupabaseMutation =
  | (QueueBase & { kind: 'profile_upsert'; payload: ProfileUpsertPayload })
  | (QueueBase & { kind: 'turn_insert'; payload: TurnInsertPayload })
  | (QueueBase & { kind: 'turn_register'; payload: TurnRegisterPayload })
  | (QueueBase & { kind: 'activity_insert'; payload: ActivityInsertPayload })
  | (QueueBase & { kind: 'follow_event_insert'; payload: FollowEventMutationPayload })
  | (QueueBase & { kind: 'follow_event_delete'; payload: FollowEventMutationPayload })
  | (QueueBase & { kind: 'mark_badges_seen'; payload: { user_id: string } })
  | (QueueBase & { kind: 'reset_progress'; payload: { user_id: string } });

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type QueuedSupabaseMutationInput = DistributiveOmit<
  QueuedSupabaseMutation,
  'id' | 'createdAt' | 'attempts' | 'lastError'
>;

function isQueuedMutationKind(value: unknown): value is QueuedMutationKind {
  return (
    typeof value === 'string' &&
    (QUEUED_MUTATION_KINDS as readonly string[]).includes(value)
  );
}

export function isNavigatorOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export async function readTurnGeolocationSnapshot(): Promise<TurnGeolocationSnapshot | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
      },
      () => resolve(null),
      {
        // High accuracy is intentionally enabled here to ensure reliable venue/turn validation,
        // at the cost of higher battery usage on some devices.
        enableHighAccuracy: true,
        timeout: 10000,
        // Limit cached positions to 5 seconds to avoid using stale locations for check-in logic.
        maximumAge: 5000,
      }
    );
  });
}

export function summarizeQueuedMutation(
  mutation:
    | QueuedSupabaseMutation
    | (QueuedSupabaseMutationInput & { id?: string; attempts?: number })
) {
  const base = {
    id: mutation.id,
    kind: mutation.kind,
    userId: mutation.userId,
    attempts: mutation.attempts ?? 0,
  };

  switch (mutation.kind) {
    case 'profile_upsert':
      return {
        ...base,
        profileId: mutation.payload.id,
        roleId: mutation.payload.role_id,
      };
    case 'turn_insert':
      return {
        ...base,
        turnId: mutation.payload.id,
        eventId: mutation.payload.event_id,
        roleId: mutation.payload.role_id,
      };
    case 'turn_register':
      return {
        ...base,
        turnId: mutation.payload.id,
        eventId: mutation.payload.event_id,
        roleId: mutation.payload.role_id,
        boostRequested: mutation.payload.boost_requested,
        syncStatus: mutation.payload.sync_status,
      };
    case 'activity_insert':
      return {
        ...base,
        completionId: mutation.payload.id,
        activityId: mutation.payload.activity_id,
      };
    case 'follow_event_insert':
    case 'follow_event_delete':
      return {
        ...base,
        eventId: mutation.payload.event_id,
        roleId: mutation.payload.planned_role_id,
      };
    case 'mark_badges_seen':
    case 'reset_progress':
      return base;
  }
}

export function readQueuedSupabaseMutations(): QueuedSupabaseMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    if (!raw) {
      logOfflineSync('Queue read: no persisted data found');
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      logOfflineSync('Queue read: malformed payload (not array), ignoring', { parsed }, 'warn');
      return [];
    }

    const queue: QueuedSupabaseMutation[] = [];
    parsed.forEach((entry) => {
      if (!isRecord(entry)) return;
      if (!isQueuedMutationKind(entry.kind)) return;

      const userId = typeof entry.userId === 'string' ? entry.userId.trim() : '';
      if (!userId) return;
      const payload = isRecord(entry.payload) ? entry.payload : {};
      const id =
        typeof entry.id === 'string' && entry.id.trim() ? entry.id : createOfflineMutationId();
      const createdAt =
        typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
          ? entry.createdAt
          : Date.now();
      const attempts =
        typeof entry.attempts === 'number' && Number.isFinite(entry.attempts)
          ? Math.max(0, Math.floor(entry.attempts))
          : 0;
      const lastError =
        typeof entry.lastError === 'string' && entry.lastError.trim()
          ? entry.lastError.trim()
          : undefined;
      const base = { id, userId, createdAt, attempts, lastError };

      switch (entry.kind) {
        case 'profile_upsert':
          queue.push({ ...base, kind: 'profile_upsert', payload: payload as ProfileUpsertPayload });
          break;
        case 'turn_insert':
          queue.push({ ...base, kind: 'turn_insert', payload: payload as TurnInsertPayload });
          break;
        case 'turn_register':
          queue.push({ ...base, kind: 'turn_register', payload: payload as TurnRegisterPayload });
          break;
        case 'activity_insert':
          queue.push({
            ...base,
            kind: 'activity_insert',
            payload: payload as ActivityInsertPayload,
          });
          break;
        case 'follow_event_insert':
          queue.push({
            ...base,
            kind: 'follow_event_insert',
            payload: payload as FollowEventMutationPayload,
          });
          break;
        case 'follow_event_delete':
          queue.push({
            ...base,
            kind: 'follow_event_delete',
            payload: payload as FollowEventMutationPayload,
          });
          break;
        case 'mark_badges_seen':
          queue.push({
            ...base,
            kind: 'mark_badges_seen',
            payload: payload as { user_id: string },
          });
          break;
        case 'reset_progress':
          queue.push({
            ...base,
            kind: 'reset_progress',
            payload: payload as { user_id: string },
          });
          break;
      }
    });

    const normalizedQueue = queue
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-OFFLINE_SYNC_MAX_ITEMS);
    logOfflineSync('Queue read complete', {
      persistedItems: parsed.length,
      normalizedItems: normalizedQueue.length,
    });
    return normalizedQueue;
  } catch {
    logOfflineSync('Queue read failed: invalid JSON payload, queue reset required', undefined, 'warn');
    return [];
  }
}

export function writeQueuedSupabaseMutations(queue: QueuedSupabaseMutation[]) {
  if (typeof window === 'undefined') return;
  try {
    if (!queue.length) {
      window.localStorage.removeItem(OFFLINE_SYNC_QUEUE_KEY);
      logOfflineSync('Queue write complete: queue cleared');
      return;
    }
    window.localStorage.setItem(
      OFFLINE_SYNC_QUEUE_KEY,
      JSON.stringify(queue.slice(-OFFLINE_SYNC_MAX_ITEMS))
    );
    logOfflineSync('Queue write complete', {
      queueSize: queue.length,
      persistedSize: Math.min(queue.length, OFFLINE_SYNC_MAX_ITEMS),
    });
  } catch {
    logOfflineSync('Queue write failed: storage error', { queueSize: queue.length }, 'warn');
  }
}

export function enqueueQueuedSupabaseMutation(input: QueuedSupabaseMutationInput) {
  let queue = readQueuedSupabaseMutations();
  const initialSize = queue.length;

  if (input.kind === 'profile_upsert') {
    queue = queue.filter(
      (mutation) => !(mutation.userId === input.userId && mutation.kind === 'profile_upsert')
    );
  }

  if (input.kind === 'follow_event_insert' || input.kind === 'follow_event_delete') {
    queue = queue.filter((mutation) => {
      if (mutation.userId !== input.userId) return true;
      if (
        mutation.kind !== 'follow_event_insert' &&
        mutation.kind !== 'follow_event_delete'
      ) {
        return true;
      }
      return mutation.payload.event_id !== input.payload.event_id;
    });
  }

  if (input.kind === 'mark_badges_seen') {
    queue = queue.filter(
      (mutation) => !(mutation.userId === input.userId && mutation.kind === 'mark_badges_seen')
    );
  }

  if (input.kind === 'reset_progress') {
    // When a reset_progress is queued, remove all pending follow_event_insert and
    // follow_event_delete mutations for the same user. Those plans are wiped by the
    // reset, so replaying them after the reset would re-create deleted plans (closes #1178).
    queue = queue.filter((mutation) => {
      if (mutation.userId !== input.userId) return true;
      return mutation.kind !== 'follow_event_insert' && mutation.kind !== 'follow_event_delete';
    });
  }
  const dedupedSize = queue.length;
  if (dedupedSize !== initialSize) {
    logOfflineSync('Queue deduplicated before enqueue', {
      removedItems: initialSize - dedupedSize,
      initialSize,
      dedupedSize,
      incomingKind: input.kind,
      incomingUserId: input.userId,
    });
  }

  const queuedMutation: QueuedSupabaseMutation = {
    ...input,
    id: createOfflineMutationId(),
    createdAt: Date.now(),
    attempts: 0,
  };
  queue.push(queuedMutation);

  writeQueuedSupabaseMutations(queue);
  logOfflineSync('Mutation queued', {
    queueSize: queue.length,
    mutation: summarizeQueuedMutation(queuedMutation),
  });
}

export function countPendingBoostRequests(queue: QueuedSupabaseMutation[], userId: string | null) {
  if (!userId) return 0;
  return queue.filter(
    (mutation) =>
      mutation.userId === userId &&
      mutation.kind === 'turn_register' &&
      mutation.payload.boost_requested &&
      mutation.payload.sync_status === 'pending'
  ).length;
}
