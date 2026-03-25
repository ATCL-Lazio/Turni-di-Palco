import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  LEGACY_SUPABASE_SESSION_ID_KEY,
  LEGACY_SUPABASE_SESSION_KEY,
  SUPABASE_SESSION_ID_KEY,
  SUPABASE_SESSION_KEY,
} from '../lib/auth-storage';
import { resolveDisplayName } from '../lib/profile-utils';
import { formatErrorDetails, reportCriticalError } from '../services/error-handler';
import { withMobileWatchdog } from '../services/mobile-watchdog';
import {
  applyMobileFeatureFlagOverrides,
  MOBILE_FEATURE_FLAGS_DEFAULTS,
  readVercelMobileFeatureFlagOverrides,
  type MobileFeatureFlagKey,
  type MobileFeatureFlagsSource,
  type MobileFeatureFlagsState,
  normalizeMobileFeatureFlags,
  readMobileFeatureFlagsCache,
  writeMobileFeatureFlagsCache,
  readEnvFeatureFlagOverrides,
} from '../services/feature-flags';

export const ROLE_IDS = ['attore', 'luci', 'fonico', 'attrezzista', 'palco', 'rspp', 'dramaturg'] as const;
export type RoleId = (typeof ROLE_IDS)[number];
export type Rewards = { xp: number; reputation: number; cachet: number };
export type TurnSyncStatus = 'pending' | 'synced' | 'synced_duplicate' | 'failed_boost_fallback';

export type RoleJourney = {
  eyebrow?: string;
  headline: string;
  summary: string;
  recommendedActivityId?: string;
  starterBadgeLabels?: string[];
  objectives?: string[];
  homeCtaLabel?: string;
};

export type RoleActivityOverride = {
  xpMultiplier?: number;
  cachetMultiplier?: number;
  reputationBonus?: number;
  highlightLabel?: string;
  homeNote?: string;
};

export type RoleProfile = {
  allowedActivityIds?: string[];
  activityOrder?: string[];
  homeMessage?: string;
  journey?: RoleJourney;
  activityOverrides?: Record<string, RoleActivityOverride>;
};

export type Role = {
  id: RoleId;
  name: string;
  focus: string;
  stats: { presence: number; precision: number; leadership: number; creativity: number };
  profile?: RoleProfile;
};

export type GameEvent = {
  id: string;
  name: string;
  theatre: string;
  date: string;
  time: string;
  genre: string;
  baseRewards: Rewards;
  focusRole?: RoleId;
};

export const EVENT_PLANNING_STATUSES = ['planned', 'confirmed', 'cancelled'] as const;
export type EventPlanningStatus = (typeof EVENT_PLANNING_STATUSES)[number];

export type EventPlanning = {
  eventId: string;
  roleId: RoleId;
  status: EventPlanningStatus;
  updatedAt: number;
};

export type Activity = {
  id: string;
  title: string;
  description: string;
  duration: string;
  xpReward: number;
  cachetReward: number;
  difficulty: 'Facile' | 'Medio' | 'Difficile';
};

export type ShopCategory = 'slot' | 'rep_atcl' | 'rep_theatre';

export type ShopCatalogItem = {
  code: string;
  title: string;
  description: string;
  category: ShopCategory;
  costCachet: number;
  effectValue: number;
  maxPurchasesPerUser: number | null;
  active: boolean;
  metadata?: Record<string, unknown>;
};

export type ActivitySlotsStatus = {
  usedToday: number;
  totalSlots: number;
  remainingSlots: number;
};

export type ActivityTelemetryInput = {
  score: number;
  rating: string;
  attempts?: number;
  durationMs?: number;
};

export type CompleteActivityResult =
  | {
    ok: true;
    activity: Activity;
    rewards: Rewards;
    slotsUsedToday: number;
    slotsTotal: number;
    cachetBalanceAfter: number;
    reputationAfter: number;
  }
  | {
    ok: false;
    error: string;
    rejectionReason?: string | null;
    slotsUsedToday?: number;
    slotsTotal?: number;
  };

export type ShopPurchaseResult =
  | {
    ok: true;
    status: 'applied' | 'duplicate';
    cachetBalanceAfter: number;
    reputationAfter: number;
    extraSlotsAfter: number;
    theatre?: string | null;
    theatreReputationAfter?: number | null;
    effect: Record<string, unknown>;
  }
  | {
    ok: false;
    status: 'rejected' | 'error';
    error: string;
    rejectionReason?: string | null;
  };

export type TurnRecord = {
  id: string;
  eventId: string;
  eventName: string;
  theatre: string;
  date: string;
  time: string;
  roleId: RoleId;
  rewards: Rewards;
  createdAt: number;
  syncStatus?: TurnSyncStatus;
  boostRequested?: boolean;
  boostApplied?: boolean;
  boostRejectionReason?: string | null;
};

export type PlayerProfile = {
  name: string;
  email: string;
  roleId: RoleId;
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpTotal: number;
  xpField: number;
  reputation: number;
  cachet: number;
  tokenAtcl: number;
  extraActivitySlots: number;
  profileImage?: string;
  lastActivityAt: number;
};

export type RegisterTurnInput = {
  eventId: string;
  roleId: RoleId;
  eventOverride?: GameEvent;
  boostRequested?: boolean;
};

export type RegisterTurnResult =
  | {
    ok: true;
    syncStatus: TurnSyncStatus;
    boostRequested: boolean;
    boostApplied: boolean;
    boostRejectionReason: string | null;
    rewards: Rewards;
    tokenBalanceAfter: number | null;
    turn: TurnRecord;
  }
  | {
    ok: false;
    error: string;
  };

export type TurnSyncFeedback = {
  syncStatus: TurnSyncStatus;
  boostRequested: boolean;
  boostApplied: boolean;
  boostRejectionReason: string | null;
  eventName: string;
  createdAt: number;
  geolocationAvailable?: boolean;
};

export type GameState = {
  profile: PlayerProfile;
  turns: TurnRecord[];
  eventPlans: EventPlanning[];
};

export type TurnStats = {
  totalTurns: number;
  turnsThisMonth: number;
  uniqueTheatres: number;
};

export type TheatreReputation = {
  theatre: string;
  reputation: number;
  totalTurns: number;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  roleId: RoleId;
  xpTotal: number;
  cachet: number;
  reputation: number;
  turnsCount: number;
  profileImage?: string;
  lastActivityAt?: number;
};

export type BadgeMetric = 'total_turns' | 'turns_this_month' | 'unique_theatres' | 'manual';

export type Badge = {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  metric: BadgeMetric | null;
  threshold: number | null;
  isHidden: boolean;
  unlocked: boolean;
  unlockedAt: number | null;
  seenAt: number | null;
};

type CatalogState = {
  roles: Role[];
  events: GameEvent[];
  activities: Activity[];
};

// DB row types — shape returned by Supabase queries
type DbEventRow = {
  id: string;
  name: string;
  theatre: string;
  event_date: string;
  event_time: string;
  genre: string;
  base_rewards?: { xp?: number; reputation?: number; cachet?: number } | null;
  focus_role?: string | null;
};

type DbRoleRow = {
  id: string;
  name: string;
  focus: string;
  stats?: { presence?: number; precision?: number; leadership?: number; creativity?: number } | null;
  role_profile?: unknown;
};

type DbActivityRow = {
  id: string;
  title: string;
  description: string;
  duration: string;
  xp_reward: number;
  cachet_reward: number;
  difficulty: string;
};

type DbTurnRow = {
  id: string;
  event_id?: string | null;
  event_name?: string | null;
  theatre?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  role_id?: string | null;
  rewards?: { xp?: number; reputation?: number; cachet?: number } | null;
  created_at?: string | null;
};

type DbProfileRow = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role_id?: string | null;
  level?: number | null;
  xp?: number | null;
  xp_to_next_level?: number | null;
  xp_total?: number | null;
  xp_field?: number | null;
  reputation?: number | null;
  cachet?: number | null;
  token_atcl?: number | null;
  extra_activity_slots?: number | null;
  profile_image?: string | null;
  last_activity_at?: string | null;
};

type DbBadgeRow = {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  metric?: string | null;
  threshold?: number | null;
  is_hidden?: boolean | null;
  unlocked?: boolean | null;
  unlocked_at?: string | null;
  seen_at?: string | null;
};

type DbTheatreReputationRow = {
  theatre?: string | null;
  reputation?: number | null;
  total_turns?: number | null;
};

type PlannedParticipationRpcRow = {
  event_id: string;
  event_name?: string | null;
  theatre?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  role_id?: string | null;
  role_name?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// TODO: spostare i profili ruolo nel catalogo remoto per evitare duplicazione tra client e seed SQL.
const DRAMATURG_PROFILE: RoleProfile = {
  allowedActivityIds: ['copione', 'recitazione', 'ritardo'],
  activityOrder: ['copione', 'recitazione', 'ritardo'],
  homeMessage: 'Oggi il focus è rifinire ritmo, sottotesto e continuità di scena.',
  journey: {
    eyebrow: 'Percorso ruolo',
    headline: 'Costruisci il battito della scena prima dell\'ingresso in palco.',
    summary: 'Parti da Revisione copione, consolida il sottotesto e sblocca i primi badge di ruolo.',
    recommendedActivityId: 'copione',
    starterBadgeLabels: ['Primo briefing drammaturgico', 'Occhio sul testo'],
    objectives: [
      'Avvia Revisione copione e completa il primo briefing',
      'Mantieni almeno 80/100 in tre sessioni sul testo',
      'Usa Recitazione per validare ritmo e ingressi',
    ],
    homeCtaLabel: 'Apri percorso dramaturg',
  },
  activityOverrides: {
    copione: {
      xpMultiplier: 1.2,
      cachetMultiplier: 1.1,
      reputationBonus: 4,
      highlightLabel: 'Missione dramaturg',
      homeNote: 'Perfetta per sbloccare i badge dedicati al testo.',
    },
    recitazione: {
      xpMultiplier: 1.08,
      reputationBonus: 2,
      highlightLabel: 'Analisi sottotesto',
    },
  },
};

export const roles: Role[] = [
  { id: 'attore', name: 'Attore / Attrice', focus: 'Presenza scenica', stats: { presence: 90, precision: 70, leadership: 60, creativity: 85 } },
  { id: 'luci', name: 'Tecnico Luci', focus: 'Precisione cue', stats: { presence: 50, precision: 95, leadership: 65, creativity: 75 } },
  { id: 'fonico', name: 'Fonico', focus: 'Pulizia audio', stats: { presence: 45, precision: 90, leadership: 60, creativity: 70 } },
  { id: 'attrezzista', name: 'Attrezzista / Scenografo', focus: 'Allestimento rapido', stats: { presence: 55, precision: 85, leadership: 70, creativity: 90 } },
  { id: 'palco', name: 'Assistente di Palco', focus: 'Coordinamento', stats: { presence: 60, precision: 88, leadership: 85, creativity: 65 } },
  { id: 'rspp', name: 'RSPP', focus: 'Sicurezza e prevenzione', stats: { presence: 65, precision: 92, leadership: 88, creativity: 58 } },
  {
    id: 'dramaturg',
    name: 'Dramaturg',
    focus: 'Analisi del testo e ritmo di scena',
    stats: { presence: 70, precision: 82, leadership: 78, creativity: 92 },
    profile: DRAMATURG_PROFILE,
  },
];

export const events: GameEvent[] = [
  {
    id: 'ATCL-001',
    name: 'Prova aperta - Teatro di Latina',
    theatre: 'Teatro di Latina',
    date: '15 Dic 2025',
    time: '20:30',
    genre: 'Drama',
    baseRewards: { xp: 150, reputation: 25, cachet: 100 },
    focusRole: 'attrezzista',
  },
  {
    id: 'ATCL-002',
    name: 'Festival Giovani Voci',
    theatre: "Teatro dell'Unione",
    date: '10 Gen 2026',
    time: '21:00',
    genre: 'Musical',
    baseRewards: { xp: 160, reputation: 30, cachet: 120 },
    focusRole: 'fonico',
  },
  {
    id: 'ATCL-003',
    name: 'Prima nazionale - Circuito ATCL',
    theatre: 'Teatro Palladium',
    date: '02 Feb 2026',
    time: '20:45',
    genre: 'Opera',
    baseRewards: { xp: 180, reputation: 35, cachet: 140 },
    focusRole: 'luci',
  },
];

export const activities: Activity[] = [
  {
    id: 'ritardo',
    title: 'Prova generale in ritardo',
    description: "La compagnia è in ritardo di 20 minuti. Devi gestire il clima e chiudere la prova.",
    duration: '5 min',
    xpReward: 50,
    cachetReward: 20,
    difficulty: 'Medio',
  },
  {
    id: 'audio',
    title: 'Prova audio critica',
    description: 'Un rientro micro crea Larsen. Il tempo stringe prima dell’apertura porte.',
    duration: '6 min',
    xpReward: 60,
    cachetReward: 25,
    difficulty: 'Difficile',
  },
  {
    id: 'palco',
    title: 'Cambio scena rapido',
    description: 'Il cambio scena tra due atti è più lento del previsto. Serve velocizzare.',
    duration: '4 min',
    xpReward: 55,
    cachetReward: 22,
    difficulty: 'Medio',
  },
  {
    id: 'recitazione',
    title: 'Prova di recitazione',
    description: 'Esercita le tue abilità di interpretazione con un monologo classico.',
    duration: '5 min',
    xpReward: 45,
    cachetReward: 18,
    difficulty: 'Facile',
  },
  {
    id: 'copione',
    title: 'Revisione copione',
    description: 'Analizza le transizioni del testo e blocca i passaggi critici nel punto giusto.',
    duration: '5 min',
    xpReward: 58,
    cachetReward: 24,
    difficulty: 'Medio',
  },
];

const DEFAULT_SHOP_CATALOG: ShopCatalogItem[] = [
  {
    code: 'extra_slot_permanent',
    title: 'Slot attività extra (permanente)',
    description: 'Aumenta il numero massimo di attività giornaliere.',
    category: 'slot',
    costCachet: 4000,
    effectValue: 1,
    maxPurchasesPerUser: 2,
    active: true,
  },
  {
    code: 'rep_pack_atcl',
    title: 'Pack reputazione ATCL',
    description: 'Aumenta la reputazione ATCL globale.',
    category: 'rep_atcl',
    costCachet: 1200,
    effectValue: 10,
    maxPurchasesPerUser: null,
    active: true,
  },
  {
    code: 'rep_pack_theatre',
    title: 'Pack reputazione Teatro',
    description: 'Aumenta la reputazione in un teatro già giocato.',
    category: 'rep_theatre',
    costCachet: 1800,
    effectValue: 15,
    maxPurchasesPerUser: null,
    active: true,
  },
];

const STORAGE_KEY = 'tdp-mobile-ui-state';
// Maximum number of turns the mobile client keeps in memory/uses for a game session.
// This is intentionally bounded to avoid unbounded state growth on long‑running devices
// and to keep UI and sync operations predictable.
const MAX_TURNS = 20;

// Key used to persist the client‑side offline sync queue in storage. Version suffix (`v1`)
// allows us to invalidate incompatible queue formats by bumping the version.
const OFFLINE_SYNC_QUEUE_KEY = 'tdp-mobile-offline-sync-v1';

// Base delay between retry attempts when flushing the offline sync queue.
// 15 seconds is a compromise between user‑perceived latency (shorter is better)
// and avoiding excessive battery and network usage on poor/unstable connections.
const OFFLINE_SYNC_RETRY_INTERVAL_MS = 15000;

// Upper bound on how many pending items we keep in the offline queue.
// 300 items is large enough to cover typical offline sessions, but small enough
// to avoid unbounded local storage usage and large burst uploads when connectivity returns.
const OFFLINE_SYNC_MAX_ITEMS = 300;

// Maximum number of retry attempts per item before we give up.
// 12 attempts at 15 s intervals ~= 3 minutes total retry window, which is long enough
// to ride out short outages without keeping failing items around indefinitely.
const OFFLINE_SYNC_MAX_ATTEMPTS = 12;

// Separate storage key for server log events queued for upload.
// Kept distinct from the main data queue so that logging policies can evolve independently.
const OFFLINE_SYNC_SERVER_LOG_QUEUE_KEY = 'tdp-mobile-offline-sync-server-logs-v1';

// Number of log items sent per batch to the logging endpoint.
// 60 strikes a balance between request overhead (fewer, larger batches) and
// memory/CPU usage on low‑end devices (smaller payloads).
const OFFLINE_SYNC_SERVER_LOG_BATCH_SIZE = 60;

// Hard cap on how many log items we retain offline.
// 2500 is enough for diagnostics across long offline periods while preventing
// unbounded growth of log storage and very large upload bursts.
const OFFLINE_SYNC_SERVER_LOG_MAX_ITEMS = 2500;

// Retry interval for log uploads; shorter than data sync to reduce time‑to‑insight
// for production issues, but still conservative to avoid hammering the backend.
const OFFLINE_SYNC_SERVER_LOG_RETRY_INTERVAL_MS = 8000;

// Supabase edge function used to receive mobile client logs.
// Kept as a constant so that changing the function name is centralized.
const OFFLINE_SYNC_SERVER_LOG_FUNCTION = 'mobile-logs';

// Feature flag that enables mirroring of offline logs to an additional backend.
// Controlled by environment so that log mirroring can be toggled per deployment.
const OFFLINE_SYNC_SERVER_LOG_MIRROR_ENV =
  import.meta.env.VITE_OFFLINE_SYNC_SERVER_LOG_MIRROR_ENABLED;

// Hostname pattern used to identify preview environments where server log behavior
// may differ (e.g., additional logging or relaxed limits).
const OFFLINE_SYNC_SERVER_LOG_PREVIEW_HOST_RE = /^turni-di-palco-pr-\d+\.onrender\.com$/i;

// Common prefix for all offline sync–related log messages to make them easy to filter.
const OFFLINE_SYNC_LOG_PREFIX = '[TDP Offline Sync]';

// Per‑operation watchdog timeouts (in ms) for network/API calls.
// Values are tuned based on typical Supabase and backend response times on mobile networks:
// short enough to detect hangs and surface errors, but long enough to tolerate
// transient latency spikes without failing normal requests.
const MOBILE_WATCHDOG_TIMEOUTS = {
  refreshTurnStats: 10000,
  refreshTheatreReputation: 12000,
  refreshBadges: 15000,
  refreshLeaderboard: 15000,
  markBadgesSeen: 12000,
  restoreSession: 15000,
  refreshEventPlanning: 12000,
  followEvent: 10000,
  unfollowEvent: 10000,
  loadCatalog: 18000,
  loadFeatureFlags: 10000,
  loadRemoteState: 20000,
  persistProfile: 12000,
  registerTurnInsert: 12000,
  completeActivityRpc: 12000,
  shopPurchase: 12000,
  loadShopCatalog: 12000,
  loadActivitySlots: 10000,
  resetProgress: 20000,
  changePassword: 20000,
  sendPasswordResetEmail: 12000,
} as const;
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

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

type ProfileUpsertPayload = {
  id: string;
  name: string;
  email: string;
  role_id: RoleId;
  profile_image?: string | null;
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

type TurnRegisterPayload = {
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

type QueuedSupabaseMutation =
  | (QueueBase & { kind: 'profile_upsert'; payload: ProfileUpsertPayload })
  | (QueueBase & { kind: 'turn_insert'; payload: TurnInsertPayload })
  | (QueueBase & { kind: 'turn_register'; payload: TurnRegisterPayload })
  | (QueueBase & { kind: 'activity_insert'; payload: ActivityInsertPayload })
  | (QueueBase & { kind: 'follow_event_insert'; payload: FollowEventMutationPayload })
  | (QueueBase & { kind: 'follow_event_delete'; payload: FollowEventMutationPayload })
  | (QueueBase & { kind: 'mark_badges_seen'; payload: { user_id: string } })
  | (QueueBase & { kind: 'reset_progress'; payload: { user_id: string } });

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type QueuedSupabaseMutationInput = DistributiveOmit<
  QueuedSupabaseMutation,
  'id' | 'createdAt' | 'attempts' | 'lastError'
>;

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

function readMirroredClientLogs(): MirroredClientLogEntry[] {
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

function writeMirroredClientLogs(queue: MirroredClientLogEntry[]) {
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

function logOfflineSync(message: string, details?: unknown, level: OfflineSyncLogLevel = 'info') {
  const formattedMessage = `${OFFLINE_SYNC_LOG_PREFIX} ${new Date().toISOString()} ${message}`;
  if (level === 'warn') {
    if (details === undefined) console.warn(formattedMessage);
    else console.warn(formattedMessage, details);
  } else if (level === 'error') {
    if (details === undefined) console.error(formattedMessage);
    else console.error(formattedMessage, details);
  } else {
    if (details === undefined) console.info(formattedMessage);
    else console.info(formattedMessage, details);
  }
  enqueueMirroredClientLog(message, level, details);
}

function decodeUnicodeEscapes(value: string) {
  if (!value.includes('\\u')) return value;
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (match, codePoint: string) => {
    const parsed = Number.parseInt(codePoint, 16);
    if (!Number.isFinite(parsed)) return match;
    return String.fromCodePoint(parsed);
  });
}

function decodeHtmlEntities(value: string) {
  if (!value.includes('&')) return value;
  let decoded = value;
  for (let i = 0; i < 2; i += 1) {
    const next = decoded.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity[0] === '#') {
        const isHex = entity[1]?.toLowerCase() === 'x';
        const number = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (!Number.isFinite(number)) return match;
        try {
          return String.fromCodePoint(number);
        } catch {
          return match;
        }
      }
      return HTML_ENTITY_MAP[entity] ?? match;
    });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function normalizeText(value: string | null | undefined) {
  if (!value) return '';
  return decodeHtmlEntities(decodeUnicodeEscapes(value));
}

function isEventPlanningStatus(value: unknown): value is EventPlanningStatus {
  return typeof value === 'string'
    && (EVENT_PLANNING_STATUSES as readonly string[]).includes(value);
}

function resolveEventPlanningStatus(value: unknown): EventPlanningStatus {
  return isEventPlanningStatus(value) ? value : 'planned';
}

function resolveEventPlanningRoleId(value: unknown, fallbackRoleId: RoleId): RoleId {
  return isRoleId(value) ? value : fallbackRoleId;
}

function parseEventScheduleTimestamp(event: Pick<GameEvent, 'date' | 'time'>) {
  const timestamp = new Date(`${event.date} ${event.time}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortEventsForPlanning(events: GameEvent[]) {
  const now = Date.now();
  return [...events].sort((left, right) => {
    const leftTimestamp = parseEventScheduleTimestamp(left);
    const rightTimestamp = parseEventScheduleTimestamp(right);
    const leftFuture = leftTimestamp >= now;
    const rightFuture = rightTimestamp >= now;

    if (leftFuture !== rightFuture) return leftFuture ? -1 : 1;
    if (leftFuture && rightFuture) return leftTimestamp - rightTimestamp;
    return rightTimestamp - leftTimestamp;
  });
}

function upsertEventPlan(plans: EventPlanning[], nextPlan: EventPlanning) {
  const filtered = plans.filter((plan) => plan.eventId !== nextPlan.eventId);
  return [nextPlan, ...filtered].sort((left, right) => right.updatedAt - left.updatedAt);
}

function removeEventPlan(plans: EventPlanning[], eventId: string) {
  return plans.filter((plan) => plan.eventId !== eventId);
}

function notifyCriticalError(message: string, errors: unknown[]) {
  const details = formatErrorDetails(errors);
  reportCriticalError({
    message,
    details: details || undefined,
  });
}

type StoredSession = { access_token: string; refresh_token: string; user_id?: string };

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const keys = [SUPABASE_SESSION_KEY, LEGACY_SUPABASE_SESSION_KEY];
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed.access_token || !parsed.refresh_token) continue;
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function persistStoredSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  try {
    const sessionKeys = [SUPABASE_SESSION_KEY, LEGACY_SUPABASE_SESSION_KEY];
    const sessionIdKeys = [SUPABASE_SESSION_ID_KEY, LEGACY_SUPABASE_SESSION_ID_KEY];

    if (!session) {
      sessionKeys.forEach((key) => window.localStorage.removeItem(key));
      sessionIdKeys.forEach((key) => window.localStorage.removeItem(key));
      return;
    }
    const payload: StoredSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: session.user.id,
    };
    window.localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(payload));
    window.localStorage.setItem(SUPABASE_SESSION_ID_KEY, session.user.id);
    // Cleanup unscoped legacy keys to avoid cross-project token bleed.
    window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_KEY);
    window.localStorage.removeItem(LEGACY_SUPABASE_SESSION_ID_KEY);
  } catch {
    // ignore storage errors
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === 'string' && (ROLE_IDS as readonly string[]).includes(value);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const next = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return next.length ? next : undefined;
}

function normalizeRoleJourney(value: unknown): RoleJourney | undefined {
  if (!isRecord(value)) return undefined;
  const headline = typeof value.headline === 'string' ? value.headline.trim() : '';
  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  if (!headline || !summary) return undefined;
  const eyebrow = typeof value.eyebrow === 'string' && value.eyebrow.trim()
    ? value.eyebrow.trim()
    : undefined;
  const recommendedActivityId =
    typeof value.recommendedActivityId === 'string' && value.recommendedActivityId.trim()
      ? value.recommendedActivityId.trim()
      : undefined;
  const starterBadgeLabels = normalizeStringArray(value.starterBadgeLabels);
  const objectives = normalizeStringArray(value.objectives);
  const homeCtaLabel = typeof value.homeCtaLabel === 'string' && value.homeCtaLabel.trim()
    ? value.homeCtaLabel.trim()
    : undefined;

  return {
    eyebrow,
    headline,
    summary,
    recommendedActivityId,
    starterBadgeLabels,
    objectives,
    homeCtaLabel,
  };
}

function normalizeRoleActivityOverride(value: unknown): RoleActivityOverride | undefined {
  if (!isRecord(value)) return undefined;
  const xpMultiplier = Number(value.xpMultiplier);
  const cachetMultiplier = Number(value.cachetMultiplier);
  const reputationBonus = Number(value.reputationBonus);
  const highlightLabel = typeof value.highlightLabel === 'string' && value.highlightLabel.trim()
    ? value.highlightLabel.trim()
    : undefined;
  const homeNote = typeof value.homeNote === 'string' && value.homeNote.trim()
    ? value.homeNote.trim()
    : undefined;

  const next: RoleActivityOverride = {};
  if (Number.isFinite(xpMultiplier) && xpMultiplier > 0) next.xpMultiplier = xpMultiplier;
  if (Number.isFinite(cachetMultiplier) && cachetMultiplier > 0) next.cachetMultiplier = cachetMultiplier;
  if (Number.isFinite(reputationBonus)) next.reputationBonus = Math.round(reputationBonus);
  if (highlightLabel) next.highlightLabel = highlightLabel;
  if (homeNote) next.homeNote = homeNote;
  return Object.keys(next).length ? next : undefined;
}

function normalizeRoleProfile(value: unknown): RoleProfile | undefined {
  if (!isRecord(value)) return undefined;
  const allowedActivityIds = normalizeStringArray(value.allowedActivityIds);
  const activityOrder = normalizeStringArray(value.activityOrder);
  const homeMessage = typeof value.homeMessage === 'string' && value.homeMessage.trim()
    ? value.homeMessage.trim()
    : undefined;
  const journey = normalizeRoleJourney(value.journey);
  const activityOverrides = isRecord(value.activityOverrides)
    ? Object.fromEntries(
      Object.entries(value.activityOverrides)
        .map(([activityId, override]) => [activityId, normalizeRoleActivityOverride(override)])
        .filter((entry): entry is [string, RoleActivityOverride] => Boolean(entry[1]))
    )
    : undefined;

  const next: RoleProfile = {};
  if (allowedActivityIds?.length) next.allowedActivityIds = allowedActivityIds;
  if (activityOrder?.length) next.activityOrder = activityOrder;
  if (homeMessage) next.homeMessage = homeMessage;
  if (journey) next.journey = journey;
  if (activityOverrides && Object.keys(activityOverrides).length) next.activityOverrides = activityOverrides;
  return Object.keys(next).length ? next : undefined;
}

export function getRoleActivityOverride(
  role: Role | null | undefined,
  activityId: string
): RoleActivityOverride | undefined {
  return role?.profile?.activityOverrides?.[activityId];
}

export function computeActivityRewards(
  activity: Activity,
  role: Role | null | undefined
): Rewards {
  const override = getRoleActivityOverride(role, activity.id);
  const xpMultiplier = override?.xpMultiplier ?? 1;
  const cachetMultiplier = override?.cachetMultiplier ?? 1;
  const reputationBonus = override?.reputationBonus ?? 0;

  return {
    xp: Math.max(0, Math.round(activity.xpReward * xpMultiplier)),
    cachet: Math.max(0, Math.round(activity.cachetReward * cachetMultiplier)),
    reputation: Math.max(0, 5 + reputationBonus),
  };
}

function isQueuedMutationKind(value: unknown): value is QueuedMutationKind {
  return (
    typeof value === 'string' &&
    (QUEUED_MUTATION_KINDS as readonly string[]).includes(value)
  );
}

function isNavigatorOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function parseOptionalBooleanEnv(value: unknown): boolean | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function shouldMirrorOfflineSyncLogsToServer() {
  const envOverride = parseOptionalBooleanEnv(OFFLINE_SYNC_SERVER_LOG_MIRROR_ENV);
  if (envOverride !== null) return envOverride;
  if (typeof window === 'undefined') return true;
  return !OFFLINE_SYNC_SERVER_LOG_PREVIEW_HOST_RE.test(window.location.hostname);
}

let offlineMutationIdFallbackCounter = 0;

function createOfflineMutationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Format as a UUID-like hex string to keep IDs readable and unique enough
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `offline-${Date.now()}-${hex.slice(0, 16)}`;
  }

  // Last-resort fallback without using Math.random (not cryptographically secure)
  offlineMutationIdFallbackCounter += 1;
  return `offline-${Date.now()}-${offlineMutationIdFallbackCounter}`;
}

async function readTurnGeolocationSnapshot(): Promise<TurnGeolocationSnapshot | null> {
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

function summarizeQueuedMutation(
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

function readQueuedSupabaseMutations(): QueuedSupabaseMutation[] {
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

function writeQueuedSupabaseMutations(queue: QueuedSupabaseMutation[]) {
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

function enqueueQueuedSupabaseMutation(input: QueuedSupabaseMutationInput) {
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
    queue = queue.filter((mutation) => {
      if (mutation.userId !== input.userId) return true;
      return mutation.kind === 'follow_event_insert' || mutation.kind === 'follow_event_delete';
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

function formatSyncError(error: unknown) {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const TURN_REGISTRATION_ERROR_MESSAGES: Array<{ token: string; message: string }> = [
  {
    token: 'geolocation_required',
    message: 'Geolocalizzazione obbligatoria per confermare il turno. Abilita il GPS e riprova.',
  },
  {
    token: 'outside_geofence',
    message: "Sei fuori dal raggio del teatro. Avvicinati al luogo dell'evento e riprova.",
  },
  {
    token: 'invalid_checkin_latitude',
    message: 'Coordinate GPS non valide (latitudine). Riprova dopo aver aggiornato la posizione.',
  },
  {
    token: 'invalid_checkin_longitude',
    message: 'Coordinate GPS non valide (longitudine). Riprova dopo aver aggiornato la posizione.',
  },
  {
    token: 'theatre_geofence_not_configured',
    message: 'Geofence non configurato per questo teatro. Contatta il supporto ATCL.',
  },
  {
    token: 'theatres_table_not_found',
    message: 'Configurazione teatri assente sul server. Contatta il supporto ATCL.',
  },
  {
    token: 'theatres_geodata_columns_missing',
    message: 'Configurazione coordinate teatri incompleta sul server. Contatta il supporto ATCL.',
  },
  {
    token: 'already_registered',
    message: 'Hai già registrato un turno per questo evento.',
  },
  {
    token: 'invalid_coordinates',
    message: 'Coordinate GPS non valide. Verifica il GPS e riprova.',
  },
];

export function localizeTurnRegistrationError(error: unknown): string {
  const raw = formatSyncError(error);
  const normalized = raw.toLowerCase();
  for (const entry of TURN_REGISTRATION_ERROR_MESSAGES) {
    if (normalized.includes(entry.token)) {
      return entry.message;
    }
  }
  return raw;
}

function getSyncErrorStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  const status = error.status;
  if (typeof status === 'number' && Number.isFinite(status)) return status;
  if (typeof status === 'string') {
    const parsed = Number.parseInt(status, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getSyncErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const code = error.code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

function isDuplicateSyncError(error: unknown) {
  const code = getSyncErrorCode(error);
  if (code === '23505') return true;
  const status = getSyncErrorStatus(error);
  if (status === 409) return true;
  const message = formatSyncError(error).toLowerCase();
  return (
    message.includes('duplicate') ||
    message.includes('already exists') ||
    message.includes('already followed') ||
    message.includes('already_registered')
  );
}

function shouldRetrySyncError(error: unknown) {
  if (isNavigatorOffline()) return true;
  const status = getSyncErrorStatus(error);
  if (status != null) {
    if (status === 0 || status === 401 || status === 403 || status === 408 || status === 429) {
      return true;
    }
    if (status >= 500) return true;
  }
  const message = formatSyncError(error).toLowerCase();
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout') ||
    message.includes('tempor')
  );
}

function buildProfileUpsertPayload(userId: string, profile: PlayerProfile): ProfileUpsertPayload {
  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    role_id: profile.roleId,
    profile_image: profile.profileImage ?? null,
  };
}

type TurnRegistrationRpcRow = {
  turn_registered: boolean;
  boost_requested: boolean;
  boost_applied: boolean;
  boost_rejection_reason: string | null;
  rewards_applied: Rewards;
  token_balance_after: number | null;
};

export function resolveTurnSyncStatusFromRpc(rpcRow: Pick<TurnRegistrationRpcRow, 'turn_registered' | 'boost_requested' | 'boost_applied'>): TurnSyncStatus {
  if (!rpcRow.turn_registered) return 'synced_duplicate';
  if (rpcRow.boost_requested && !rpcRow.boost_applied) return 'failed_boost_fallback';
  return 'synced';
}

function normalizeRewardsPayload(value: unknown): Rewards {
  if (!isRecord(value)) return { xp: 0, reputation: 0, cachet: 0 };
  return {
    xp: Number(value.xp ?? 0),
    reputation: Number(value.reputation ?? 0),
    cachet: Number(value.cachet ?? 0),
  };
}

function parseTurnRegistrationRpcRow(data: unknown): TurnRegistrationRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return null;
  const tokenBalanceRaw = Number(row.token_balance_after ?? 0);
  return {
    turn_registered: Boolean(row.turn_registered),
    boost_requested: Boolean(row.boost_requested),
    boost_applied: Boolean(row.boost_applied),
    boost_rejection_reason:
      typeof row.boost_rejection_reason === 'string' && row.boost_rejection_reason.trim()
        ? row.boost_rejection_reason.trim()
        : null,
    rewards_applied: normalizeRewardsPayload(row.rewards_applied),
    token_balance_after: Number.isFinite(tokenBalanceRaw) ? tokenBalanceRaw : null,
  };
}

type ActivityCompletionRpcRow = {
  activity_registered: boolean;
  status: string;
  rejection_reason: string | null;
  rewards_applied: Rewards;
  slots_used_today: number;
  slots_total: number;
  cachet_balance_after: number;
  reputation_after: number;
};

function parseActivityCompletionRpcRow(data: unknown): ActivityCompletionRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return null;
  return {
    activity_registered: Boolean(row.activity_registered),
    status: typeof row.status === 'string' ? row.status : 'rejected',
    rejection_reason:
      typeof row.rejection_reason === 'string' && row.rejection_reason.trim()
        ? row.rejection_reason.trim()
        : null,
    rewards_applied: normalizeRewardsPayload(row.rewards_applied),
    slots_used_today: Number(row.slots_used_today ?? 0),
    slots_total: Number(row.slots_total ?? 3),
    cachet_balance_after: Number(row.cachet_balance_after ?? 0),
    reputation_after: Number(row.reputation_after ?? 0),
  };
}

type ActivitySlotsRpcRow = {
  used_today: number;
  total_slots: number;
  remaining_slots: number;
};

function parseActivitySlotsRpcRow(data: unknown): ActivitySlotsRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return null;
  return {
    used_today: Number(row.used_today ?? 0),
    total_slots: Number(row.total_slots ?? 3),
    remaining_slots: Number(row.remaining_slots ?? 3),
  };
}

type ShopPurchaseRpcRow = {
  purchase_applied: boolean;
  status: string;
  rejection_reason: string | null;
  cachet_balance_after: number;
  profile_reputation_after: number;
  extra_slots_after: number;
  theatre: string | null;
  theatre_reputation_after: number | null;
  effect: Record<string, unknown>;
};

function parseShopPurchaseRpcRow(data: unknown): ShopPurchaseRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return null;
  const theatreReputationRaw = Number(row.theatre_reputation_after ?? 0);
  return {
    purchase_applied: Boolean(row.purchase_applied),
    status: typeof row.status === 'string' ? row.status : 'rejected',
    rejection_reason:
      typeof row.rejection_reason === 'string' && row.rejection_reason.trim()
        ? row.rejection_reason.trim()
        : null,
    cachet_balance_after: Number(row.cachet_balance_after ?? 0),
    profile_reputation_after: Number(row.profile_reputation_after ?? 0),
    extra_slots_after: Number(row.extra_slots_after ?? 0),
    theatre: typeof row.theatre === 'string' && row.theatre.trim() ? row.theatre.trim() : null,
    theatre_reputation_after: Number.isFinite(theatreReputationRaw) ? theatreReputationRaw : null,
    effect: isRecord(row.effect) ? row.effect : {},
  };
}

function parseShopCatalogRows(data: unknown): ShopCatalogItem[] {
  if (!Array.isArray(data)) return DEFAULT_SHOP_CATALOG;
  const parsed = data
    .filter((entry) => isRecord(entry))
    .map((entry) => {
      const category = typeof entry.category === 'string' ? entry.category : 'slot';
      if (category !== 'slot' && category !== 'rep_atcl' && category !== 'rep_theatre') return null;
      return {
        code: typeof entry.code === 'string' ? entry.code : '',
        title: typeof entry.title === 'string' ? entry.title : '',
        description: typeof entry.description === 'string' ? entry.description : '',
        category,
        costCachet: Number(entry.cost_cachet ?? 0),
        effectValue: Number(entry.effect_value ?? 0),
        maxPurchasesPerUser:
          entry.max_purchases_per_user == null ? null : Number(entry.max_purchases_per_user),
        active: Boolean(entry.active),
        metadata: isRecord(entry.metadata) ? entry.metadata : {},
      } satisfies ShopCatalogItem;
    })
    .filter((entry) => entry !== null && entry.code.trim().length > 0) as ShopCatalogItem[];

  if (!parsed.length) return DEFAULT_SHOP_CATALOG;
  return parsed;
}

function buildTurnRecordFromPayload(
  payload: TurnRegisterPayload,
  rewards: Rewards,
  syncStatus: TurnSyncStatus,
  boostApplied: boolean,
  boostRejectionReason: string | null
): TurnRecord {
  return {
    id: payload.id,
    eventId: payload.event_id,
    eventName: payload.event_name,
    theatre: payload.theatre,
    date: payload.event_date,
    time: payload.event_time,
    roleId: payload.role_id,
    rewards,
    createdAt: Date.now(),
    syncStatus,
    boostRequested: payload.boost_requested,
    boostApplied,
    boostRejectionReason,
  };
}

function countPendingBoostRequests(queue: QueuedSupabaseMutation[], userId: string | null) {
  if (!userId) return 0;
  return queue.filter(
    (mutation) =>
      mutation.userId === userId &&
      mutation.kind === 'turn_register' &&
      mutation.payload.boost_requested &&
      mutation.payload.sync_status === 'pending'
  ).length;
}

function createInitialState(): GameState {
  return {
    profile: {
      name: '',
      email: '',
      roleId: 'attore',
      level: 1,
      xp: 0,
      xpToNextLevel: 1000,
      xpTotal: 0,
      xpField: 0,
      reputation: 0,
      cachet: 0,
      tokenAtcl: 0,
      extraActivitySlots: 0,
      profileImage: undefined,
      lastActivityAt: Date.now(),
    },
    turns: [],
    eventPlans: [],
  };
}

function createDemoState(): GameState {
  return {
    profile: {
      name: 'Mario',
      email: 'mario@example.com',
      roleId: 'attore',
      level: 5,
      xp: 1250,
      xpToNextLevel: 2000,
      xpTotal: 3500,
      xpField: 1800,
      reputation: 75,
      cachet: 250,
      tokenAtcl: 3,
      extraActivitySlots: 1,
      profileImage: undefined,
      lastActivityAt: Date.now(),
    },
    turns: [
      {
        id: 'turn-001',
        eventId: events[0].id,
        eventName: events[0].name,
        theatre: events[0].theatre,
        date: events[0].date,
        time: events[0].time,
        roleId: 'attore',
        rewards: events[0].baseRewards,
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
      },
    ],
    eventPlans: [
      {
        eventId: events[0].id,
        roleId: 'attore',
        status: 'planned',
        updatedAt: Date.now() - 1000 * 60 * 60 * 24,
      },
    ],
  };
}

function createDefaultState(): GameState {
  if (isSupabaseConfigured) return createInitialState();
  return import.meta.env.DEV ? createDemoState() : createInitialState();
}

function loadState(): GameState {
  if (isSupabaseConfigured) return createInitialState();
  if (!import.meta.env.DEV) return createInitialState();
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.profile) return createDefaultState();
    const safeRole = isRoleId(parsed.profile.roleId) ? parsed.profile.roleId : createDefaultState().profile.roleId;
    return {
      profile: {
        ...createDefaultState().profile,
        ...parsed.profile,
        roleId: safeRole,
      },
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      eventPlans: Array.isArray(parsed.eventPlans)
        ? parsed.eventPlans
          .filter((plan): plan is EventPlanning & { status?: unknown } => isRecord(plan))
          .map((plan) => {
            const roleId = isRoleId(plan.roleId) ? plan.roleId : safeRole;
            const updatedAt =
              typeof plan.updatedAt === 'number' && Number.isFinite(plan.updatedAt)
                ? plan.updatedAt
                : Date.now();
            return {
              eventId: typeof plan.eventId === 'string' ? plan.eventId : '',
              roleId,
              status: resolveEventPlanningStatus(plan.status),
              updatedAt,
            };
          })
          .filter((plan) => plan.eventId)
        : [],
    };
  } catch {
    return createDefaultState();
  }
}

function saveState(state: GameState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function computeTurnStatsFromTurns(turns: TurnRecord[]): TurnStats {
  const totalTurns = turns.length;
  if (!turns.length) {
    return { totalTurns: 0, turnsThisMonth: 0, uniqueTheatres: 0 };
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const turnsThisMonth = turns.filter((turn) => {
    const created = new Date(turn.createdAt);
    return created.getFullYear() === year && created.getMonth() === month;
  }).length;
  const uniqueTheatres = new Set(turns.map((turn) => turn.theatre).filter(Boolean)).size;
  return { totalTurns, turnsThisMonth, uniqueTheatres };
}

function computeTheatreReputationFromTurns(turns: TurnRecord[]): TheatreReputation[] {
  const map = new Map<string, { reputation: number; totalTurns: number }>();

  turns.forEach((turn) => {
    const theatre = turn.theatre?.trim();
    if (!theatre) return;
    const previous = map.get(theatre) ?? { reputation: 0, totalTurns: 0 };
    map.set(theatre, {
      reputation: Math.min(100, previous.reputation + (turn.rewards?.reputation ?? 0)),
      totalTurns: previous.totalTurns + 1,
    });
  });

  return [...map.entries()]
    .map(([theatre, entry]) => ({
      theatre,
      reputation: entry.reputation,
      totalTurns: entry.totalTurns,
    }))
    .sort(
      (a, b) =>
        b.reputation - a.reputation ||
        b.totalTurns - a.totalTurns ||
        a.theatre.localeCompare(b.theatre)
    );
}

const FALLBACK_BADGES: Array<Omit<Badge, 'unlocked' | 'unlockedAt' | 'seenAt'>> = [
  {
    id: 'first_turn',
    title: 'Primo sipario',
    description: 'Registra il tuo primo turno ATCL.',
    icon: 'Award',
    metric: 'total_turns',
    threshold: 1,
    isHidden: false,
  },
  {
    id: 'turns_this_month_3',
    title: 'Ritmo di scena',
    description: 'Completa 3 turni nello stesso mese.',
    icon: 'Calendar',
    metric: 'turns_this_month',
    threshold: 3,
    isHidden: false,
  },
  {
    id: 'unique_theatres_3',
    title: 'Teatri in tour',
    description: 'Lavora in 3 teatri diversi.',
    icon: 'MapPin',
    metric: 'unique_theatres',
    threshold: 3,
    isHidden: false,
  },
  {
    id: 'total_turns_10',
    title: 'Presenza costante',
    description: 'Raggiungi 10 turni registrati.',
    icon: 'Theater',
    metric: 'total_turns',
    threshold: 10,
    isHidden: false,
  },
  {
    id: 'turns_this_month_6',
    title: 'Settimana piena',
    description: 'Completa 6 turni nello stesso mese.',
    icon: 'Calendar',
    metric: 'turns_this_month',
    threshold: 6,
    isHidden: true,
  },
  {
    id: 'unique_theatres_5',
    title: 'Compagnia itinerante',
    description: 'Lavora in 5 teatri diversi.',
    icon: 'MapPin',
    metric: 'unique_theatres',
    threshold: 5,
    isHidden: false,
  },
  {
    id: 'total_turns_25',
    title: 'Veterano di palco',
    description: 'Raggiungi 25 turni registrati.',
    icon: 'Award',
    metric: 'total_turns',
    threshold: 25,
    isHidden: true,
  },
  {
    id: 'unique_theatres_8',
    title: 'Mappa completa',
    description: 'Lavora in 8 teatri diversi.',
    icon: 'MapPin',
    metric: 'unique_theatres',
    threshold: 8,
    isHidden: true,
  },
];

function computeFallbackBadges(stats: TurnStats): Badge[] {
  return FALLBACK_BADGES.map((badge) => {
    const unlocked =
      badge.metric === 'total_turns' && badge.threshold != null
        ? stats.totalTurns >= badge.threshold
        : badge.metric === 'turns_this_month' && badge.threshold != null
          ? stats.turnsThisMonth >= badge.threshold
          : badge.metric === 'unique_theatres' && badge.threshold != null
            ? stats.uniqueTheatres >= badge.threshold
            : false;
    return { ...badge, unlocked, unlockedAt: null, seenAt: null };
  });
}

function applyRewards(profile: PlayerProfile, rewards: Rewards, source: 'turn' | 'activity'): PlayerProfile {
  let nextXp = profile.xp + rewards.xp;
  let nextLevel = profile.level;
  let nextThreshold = profile.xpToNextLevel;

  while (nextXp >= nextThreshold) {
    nextXp -= nextThreshold;
    nextLevel += 1;
    nextThreshold = 1000 + nextLevel * 250;
  }

  return {
    ...profile,
    xp: nextXp,
    xpToNextLevel: nextThreshold,
    level: nextLevel,
    xpTotal: profile.xpTotal + rewards.xp,
    xpField: source === 'turn' ? profile.xpField + rewards.xp : profile.xpField,
    cachet: profile.cachet + rewards.cachet,
    reputation: Math.min(100, profile.reputation + rewards.reputation),
    lastActivityAt: Date.now(),
  };
}

export function computeTurnRewards(event: GameEvent, roleId: RoleId): Rewards {
  const bonus = event.focusRole === roleId ? 15 : 0;
  return {
    xp: event.baseRewards.xp + bonus,
    cachet: event.baseRewards.cachet + Math.round(bonus / 2),
    reputation: event.baseRewards.reputation + Math.round(bonus / 3),
  };
}

type GameContextValue = {
  authUserId: string | null;
  authReady: boolean;
  hasHydratedRemote: boolean;
  state: GameState;
  roles: Role[];
  events: GameEvent[];
  activities: Activity[];
  turnStats: TurnStats;
  statsLoading: boolean;
  theatreReputation: TheatreReputation[];
  theatreReputationLoading: boolean;
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  refreshLeaderboard: () => Promise<void>;
  badges: Badge[];
  badgesLoading: boolean;
  featureFlags: MobileFeatureFlagsState;
  featureFlagsReady: boolean;
  featureFlagsSource: MobileFeatureFlagsSource;
  isFeatureEnabled: (key: MobileFeatureFlagKey) => boolean;
  eventPlans: EventPlanning[];
  eventPlansLoading: boolean;
  followedEvents: GameEvent[];
  followedEventsLoading: boolean;
  shopCatalog: ShopCatalogItem[];
  shopCatalogLoading: boolean;
  refreshShopCatalog: () => Promise<void>;
  purchaseShopItem: (itemCode: string, targetTheatre?: string | null) => Promise<ShopPurchaseResult>;
  activitySlotsStatus: ActivitySlotsStatus;
  activitySlotsLoading: boolean;
  refreshActivitySlotsStatus: () => Promise<void>;
  getEventPlan: (eventId: string) => EventPlanning | null;
  planEvent: (eventId: string, roleId: RoleId) => Promise<void>;
  cancelEventPlan: (eventId: string) => Promise<void>;
  followEvent: (eventId: string) => Promise<void>;
  unfollowEvent: (eventId: string) => Promise<void>;
  isEventFollowed: (eventId: string) => boolean;
  markBadgesSeen: () => void;
  updateProfile: (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId' | 'profileImage'>>) => void;
  registerTurn: (input: RegisterTurnInput) => Promise<RegisterTurnResult>;
  pendingBoostRequests: number;
  turnSyncFeedback: TurnSyncFeedback | null;
  clearTurnSyncFeedback: () => void;
  completeActivity: (
    activityId: string,
    telemetry?: ActivityTelemetryInput
  ) => Promise<CompleteActivityResult>;
  resetProgress: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  resetState: () => void;
};

const GameStateContext = createContext<GameContextValue | undefined>(undefined);

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => loadState());
  const [catalog, setCatalog] = useState<CatalogState>(() => ({
    roles,
    events,
    activities,
  }));
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [hasHydratedRemote, setHasHydratedRemote] = useState(false);
  const localTurnStats = useMemo(() => computeTurnStatsFromTurns(state.turns), [state.turns]);
  const localTheatreReputation = useMemo(
    () => computeTheatreReputationFromTurns(state.turns),
    [state.turns]
  );
  const [remoteTurnStats, setRemoteTurnStats] = useState<TurnStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [remoteTheatreReputation, setRemoteTheatreReputation] = useState<TheatreReputation[]>([]);
  const [theatreReputationLoading, setTheatreReputationLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [remoteBadges, setRemoteBadges] = useState<Badge[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<MobileFeatureFlagsState>(() => (
    { ...MOBILE_FEATURE_FLAGS_DEFAULTS }
  ));
  const [featureFlagsReady, setFeatureFlagsReady] = useState(true);
  const [featureFlagsSource, setFeatureFlagsSource] = useState<MobileFeatureFlagsSource>('default');
  const [eventPlans, setEventPlans] = useState<EventPlanning[]>(state.eventPlans);
  const [eventPlansLoading, setEventPlansLoading] = useState(false);
  const [followedEvents, setFollowedEvents] = useState<GameEvent[]>([]);
  const [followedEventsLoading, setFollowedEventsLoading] = useState(false);
  const [shopCatalog, setShopCatalog] = useState<ShopCatalogItem[]>(DEFAULT_SHOP_CATALOG);
  const [shopCatalogLoading, setShopCatalogLoading] = useState(false);
  const [activitySlotsStatus, setActivitySlotsStatus] = useState<ActivitySlotsStatus>({
    usedToday: 0,
    totalSlots: 3 + state.profile.extraActivitySlots,
    remainingSlots: Math.max(0, 3 + state.profile.extraActivitySlots),
  });
  const [activitySlotsLoading, setActivitySlotsLoading] = useState(false);
  const [pendingBoostRequests, setPendingBoostRequests] = useState(0);
  const [turnSyncFeedback, setTurnSyncFeedback] = useState<TurnSyncFeedback | null>(null);
  const offlineSyncInFlightRef = useRef(false);
  const offlineServerLogSyncInFlightRef = useRef(false);

  const syncLocalEventPlanning = useCallback(
    (plans: EventPlanning[]) => {
      setEventPlans(plans);
      const nextFollowedEvents = plans
        .map((plan) => catalog.events.find((event) => event.id === plan.eventId) ?? null)
        .filter((event): event is GameEvent => Boolean(event));
      setFollowedEvents(sortEventsForPlanning(nextFollowedEvents));
    },
    [catalog.events]
  );

  const turnStats = useMemo(
    () => (isSupabaseConfigured && authUserId ? remoteTurnStats ?? localTurnStats : localTurnStats),
    [authUserId, localTurnStats, remoteTurnStats]
  );

  const badges = useMemo(
    () => (isSupabaseConfigured && authUserId ? remoteBadges : computeFallbackBadges(localTurnStats)),
    [authUserId, localTurnStats, remoteBadges]
  );

  const theatreReputation = useMemo(
    () =>
      isSupabaseConfigured && authUserId ? remoteTheatreReputation : localTheatreReputation,
    [authUserId, localTheatreReputation, remoteTheatreReputation]
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const message = import.meta.env.DEV
      ? 'Supabase non configurato: dati mock attivi.'
      : 'Supabase non configurato: impossibile caricare i dati.';
    notifyCriticalError(message, []);
  }, []);

  const refreshTurnStats = useCallback(async () => {
    if (!supabase || !authUserId) return;
    await withMobileWatchdog(
      async () => {
        setStatsLoading(true);
        try {
          const { data, error } = await supabase!
            .from('my_turn_stats')
            .select('total_turns,turns_this_month,unique_theatres')
            .single();
          if (!error && data) {
            setRemoteTurnStats({
              totalTurns: Number(data.total_turns ?? 0),
              turnsThisMonth: Number(data.turns_this_month ?? 0),
              uniqueTheatres: Number(data.unique_theatres ?? 0),
            });
          }
        } finally {
          setStatsLoading(false);
        }
      },
      {
        operation: 'refreshTurnStats',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.refreshTurnStats,
        title: 'Statistiche lente',
        message: 'Il refresh delle statistiche turni sta impiegando troppo tempo.',
      }
    );
  }, [authUserId]);

  const refreshTheatreReputation = useCallback(async () => {
    if (!supabase || !authUserId) return;
    await withMobileWatchdog(
      async () => {
        setTheatreReputationLoading(true);
        try {
          const { data, error } = await supabase!
            .from('my_theatre_reputation')
            .select('theatre,reputation,total_turns');
          if (!error && data) {
            const nextReputation: TheatreReputation[] = (data as DbTheatreReputationRow[])
              .map((row) => ({
                theatre: (row.theatre ?? '').toString(),
                reputation: Number(row.reputation ?? 0),
                totalTurns: Number(row.total_turns ?? 0),
              }))
              .filter((entry) => entry.theatre)
              .sort(
                (a, b) =>
                  b.reputation - a.reputation ||
                  b.totalTurns - a.totalTurns ||
                  a.theatre.localeCompare(b.theatre)
              );
            setRemoteTheatreReputation(nextReputation);
          }
        } finally {
          setTheatreReputationLoading(false);
        }
      },
      {
        operation: 'refreshTheatreReputation',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.refreshTheatreReputation,
        title: 'Reputazione teatri lenta',
        message: 'Il refresh della reputazione teatri sta impiegando troppo tempo.',
      }
    );
  }, [authUserId]);

  const refreshBadges = useCallback(async () => {
    if (!supabase || !authUserId) return;
    await withMobileWatchdog(
      async () => {
        setBadgesLoading(true);
        try {
          await supabase!.rpc('evaluate_my_badges');
          const { data, error } = await supabase!
            .from('my_badges')
            .select('id,title,description,icon,metric,threshold,is_hidden,unlocked_at,seen_at,unlocked');
          if (!error && data) {
            const nextBadges: Badge[] = (data as DbBadgeRow[]).map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description ?? null,
              icon: row.icon ?? 'Award',
              metric: (row.metric as BadgeMetric | null) ?? null,
              threshold: row.threshold != null ? Number(row.threshold) : null,
              isHidden: Boolean(row.is_hidden),
              unlocked: Boolean(row.unlocked),
              unlockedAt: row.unlocked_at ? new Date(row.unlocked_at).getTime() : null,
              seenAt: row.seen_at ? new Date(row.seen_at).getTime() : null,
            }));
            setRemoteBadges(nextBadges);
          }
        } finally {
          setBadgesLoading(false);
        }
      },
      {
        operation: 'refreshBadges',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.refreshBadges,
        title: 'Badges lenti',
        message: 'Il refresh dei badge sta impiegando troppo tempo.',
      }
    );
  }, [authUserId]);

  type LeaderboardRow = {
    id: string;
    name: string | null;
    role_id: string | null;
    xp_total: number | null;
    cachet: number | null;
    reputation: number | null;
    profile_image: string | null;
    last_activity_at: string | null;
    turns_count: number | null;
  };

  const refreshLeaderboard = useCallback(async () => {
    if (!supabase) return;
    await withMobileWatchdog(
      async () => {
        setLeaderboardLoading(true);

        try {
          const { data, error } = await supabase!.rpc('get_leaderboard', { p_limit: 50 });
          if (error) throw error;

          const rows = (data as LeaderboardRow[]) ?? [];
          const nextLeaderboard: LeaderboardEntry[] = rows.map((row) => {
            const roleCandidate = row.role_id ?? 'attore';
            const roleId: RoleId = isRoleId(roleCandidate) ? roleCandidate : 'attore';
            const lastActivityAt = row.last_activity_at ? new Date(row.last_activity_at).getTime() : undefined;
            return {
              id: row.id,
              name: row.name ?? 'Player',
              roleId,
              xpTotal: row.xp_total ?? 0,
              cachet: row.cachet ?? 0,
              reputation: row.reputation ?? 0,
              turnsCount: row.turns_count ?? 0,
              profileImage: row.profile_image ?? undefined,
              lastActivityAt,
            };
          });
          setLeaderboard(nextLeaderboard);
        } catch (error) {
          console.warn('Supabase leaderboard fetch failed', error);
          notifyCriticalError('Non riusciamo a caricare la classifica dal database.', [error]);
          setLeaderboard([]);
        } finally {
          setLeaderboardLoading(false);
        }
      },
      {
        operation: 'refreshLeaderboard',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.refreshLeaderboard,
        title: 'Classifica lenta',
        message: 'Il refresh della classifica sta impiegando troppo tempo.',
      }
    );
  }, []);

  const flushMirroredClientLogsToServer = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !shouldMirrorOfflineSyncLogsToServer()) return;
    if (offlineServerLogSyncInFlightRef.current) return;
    if (isNavigatorOffline()) return;

    const queue = readMirroredClientLogs();
    if (!queue.length) return;

    const batch = queue.slice(0, OFFLINE_SYNC_SERVER_LOG_BATCH_SIZE);
    offlineServerLogSyncInFlightRef.current = true;
    console.info(`${OFFLINE_SYNC_LOG_PREFIX} Mirroring log batch to server`, {
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
      console.info(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror ack`, {
        acknowledged: acknowledgedSet.size,
        remaining: remaining.length,
      });
    } catch (error) {
      console.warn(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror exception`, error);
    } finally {
      offlineServerLogSyncInFlightRef.current = false;
    }
  }, [authUserId]);

  const refreshPendingBoostRequests = useCallback(
    (queueOverride?: QueuedSupabaseMutation[]) => {
      const queue = queueOverride ?? readQueuedSupabaseMutations();
      setPendingBoostRequests(countPendingBoostRequests(queue, authUserId));
    },
    [authUserId]
  );

  const applyTurnRegistrationResult = useCallback(
    (
      payload: TurnRegisterPayload,
      rpcRow: TurnRegistrationRpcRow,
      syncStatus: TurnSyncStatus,
      geolocationAvailable?: boolean
    ) => {
      const turnRecord = buildTurnRecordFromPayload(
        payload,
        rpcRow.rewards_applied,
        syncStatus,
        rpcRow.boost_applied,
        rpcRow.boost_rejection_reason
      );

      setState((prev: GameState) => {
        const turnAlreadyPresent = prev.turns.some((turn) => turn.id === turnRecord.id);
        const nextTurns = (turnAlreadyPresent
          ? prev.turns
            .map((turn) => (turn.id === turnRecord.id ? { ...turn, ...turnRecord } : turn))
            .sort((a, b) => b.createdAt - a.createdAt)
          : [turnRecord, ...prev.turns].sort((a, b) => b.createdAt - a.createdAt)).slice(0, MAX_TURNS);

        let nextProfile = prev.profile;
        if (rpcRow.turn_registered) {
          nextProfile = applyRewards(prev.profile, rpcRow.rewards_applied, 'turn');
        }

        if (rpcRow.token_balance_after != null) {
          nextProfile = {
            ...nextProfile,
            tokenAtcl: rpcRow.token_balance_after,
          };
        }

        return {
          ...prev,
          profile: nextProfile,
          turns: nextTurns,
        };
      });

      setTurnSyncFeedback({
        syncStatus,
        boostRequested: rpcRow.boost_requested,
        boostApplied: rpcRow.boost_applied,
        boostRejectionReason: rpcRow.boost_rejection_reason,
        eventName: payload.event_name,
        createdAt: Date.now(),
        geolocationAvailable,
      });
    },
    []
  );

  type QueueExecutionResult = { status: 'applied' | 'retry' | 'discard'; error?: unknown };

  const executeQueuedSupabaseMutation = useCallback(
    async (mutation: QueuedSupabaseMutation): Promise<QueueExecutionResult> => {
      if (!supabase) {
        return { status: 'retry', error: new Error('Supabase non configurato') };
      }

      try {
        if (mutation.kind === 'profile_upsert') {
          const { error } = await supabase
            .from('profiles')
            .upsert(mutation.payload, { onConflict: 'id' });
          if (!error) return { status: 'applied' };
          return shouldRetrySyncError(error)
            ? { status: 'retry', error }
            : { status: 'discard', error };
        }

        if (mutation.kind === 'turn_insert') {
          const { error } = await supabase.from('turns').insert(mutation.payload);
          if (!error || isDuplicateSyncError(error)) return { status: 'applied' };
          return shouldRetrySyncError(error)
            ? { status: 'retry', error }
            : { status: 'discard', error };
        }

        if (mutation.kind === 'turn_register') {
          const { data, error } = await supabase.rpc('register_turn_with_token_boost', {
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
          applyTurnRegistrationResult(mutation.payload, rpcRow, syncStatus, Boolean(mutation.payload.checkin_latitude && mutation.payload.checkin_longitude));
          return { status: 'applied' };
        }

        if (mutation.kind === 'activity_insert') {
          const { data, error } = await supabase.rpc('complete_activity_with_slots', {
            p_activity_id: mutation.payload.activity_id,
            p_client_action_id: mutation.payload.id,
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
          const { error } = await supabase.rpc('upsert_planned_participation', {
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
          const { error } = await supabase.rpc('remove_planned_participation', {
            p_event_id: mutation.payload.event_id,
          });
          if (!error) return { status: 'applied' };
          return shouldRetrySyncError(error)
            ? { status: 'retry', error }
            : { status: 'discard', error };
        }

        if (mutation.kind === 'mark_badges_seen') {
          const { error } = await supabase.rpc('mark_my_badges_seen');
          if (!error) return { status: 'applied' };
          return shouldRetrySyncError(error)
            ? { status: 'retry', error }
            : { status: 'discard', error };
        }

        if (mutation.kind === 'reset_progress') {
          const { error } = await supabase.rpc('reset_my_progress');
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
    },
    [applyTurnRegistrationResult]
  );

  const flushQueuedSupabaseMutations = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      logOfflineSync('Flush skipped: missing prerequisites', {
        isSupabaseConfigured,
        hasSupabaseClient: Boolean(supabase),
        authUserId,
      });
      return;
    }
    if (offlineSyncInFlightRef.current) {
      logOfflineSync('Flush skipped: already in progress');
      return;
    }
    if (isNavigatorOffline()) {
      logOfflineSync('Flush skipped: browser offline');
      return;
    }

    let queue = readQueuedSupabaseMutations();
    if (!queue.length) {
      logOfflineSync('Flush skipped: queue empty');
      return;
    }
    const queuedForUser = queue.filter((entry) => entry.userId === authUserId).length;
    if (!queuedForUser) {
      logOfflineSync('Flush skipped: no queued mutations for active user', {
        authUserId,
        queueSize: queue.length,
      });
      return;
    }

    logOfflineSync('Flush started', {
      authUserId,
      queuedForUser,
      queueSize: queue.length,
    });

    offlineSyncInFlightRef.current = true;
    let shouldRefreshTurnStats = false;
    let shouldRefreshTheatreReputation = false;
    let shouldRefreshBadges = false;

    try {
      for (const queuedMutation of [...queue]) {
        if (queuedMutation.userId !== authUserId) continue;
        if (!queue.some((entry) => entry.id === queuedMutation.id)) continue;
        logOfflineSync('Processing queued mutation', summarizeQueuedMutation(queuedMutation));

        const result = await executeQueuedSupabaseMutation(queuedMutation);
        if (result.status === 'applied' || result.status === 'discard') {
          queue = queue.filter((entry) => entry.id !== queuedMutation.id);
          writeQueuedSupabaseMutations(queue);
          refreshPendingBoostRequests(queue);
          logOfflineSync(
            result.status === 'applied'
              ? 'Mutation synced successfully'
              : 'Mutation discarded (non retryable)',
            {
              mutation: summarizeQueuedMutation(queuedMutation),
              error: result.error ? formatSyncError(result.error) : undefined,
              queueSize: queue.length,
            }
          );

          if (
            queuedMutation.kind === 'turn_insert' ||
            queuedMutation.kind === 'turn_register' ||
            queuedMutation.kind === 'activity_insert' ||
            queuedMutation.kind === 'reset_progress'
          ) {
            shouldRefreshTurnStats = true;
            shouldRefreshTheatreReputation = true;
            shouldRefreshBadges = true;
          }
          if (queuedMutation.kind === 'mark_badges_seen') {
            shouldRefreshBadges = true;
          }

          if (result.status === 'discard' && result.error) {
            console.warn(
              'Offline sync dropped mutation',
              queuedMutation.kind,
              formatSyncError(result.error)
            );
          }
          continue;
        }

        queue = queue.map((entry) =>
          entry.id === queuedMutation.id
            ? {
              ...entry,
              attempts: entry.attempts + 1,
              lastError: formatSyncError(result.error),
            }
            : entry
        );
        writeQueuedSupabaseMutations(queue);
        refreshPendingBoostRequests(queue);

        const updatedMutation = queue.find((entry) => entry.id === queuedMutation.id);
        logOfflineSync('Mutation retry scheduled', {
          mutation: summarizeQueuedMutation(updatedMutation ?? queuedMutation),
          error: formatSyncError(result.error),
        });
        if (
          updatedMutation &&
          updatedMutation.attempts >= OFFLINE_SYNC_MAX_ATTEMPTS
        ) {
          queue = queue.filter((entry) => entry.id !== queuedMutation.id);
          writeQueuedSupabaseMutations(queue);
          refreshPendingBoostRequests(queue);
          logOfflineSync('Mutation dropped after max retry attempts', {
            mutation: summarizeQueuedMutation(updatedMutation),
            queueSize: queue.length,
          });
          console.warn(
            'Offline sync dropped mutation after max attempts',
            updatedMutation.kind,
            updatedMutation.lastError
          );
          notifyCriticalError(
            'Alcune operazioni offline non sono sincronizzabili.',
            [updatedMutation.lastError ?? result.error]
          );
          continue;
        }

        break;
      }
    } finally {
      offlineSyncInFlightRef.current = false;
      refreshPendingBoostRequests(queue);
      logOfflineSync('Flush completed', {
        authUserId,
        remainingForUser: queue.filter((entry) => entry.userId === authUserId).length,
        queueSize: queue.length,
      });
    }

    const refreshTasks: Array<Promise<void>> = [];
    if (shouldRefreshTurnStats) refreshTasks.push(refreshTurnStats());
    if (shouldRefreshTheatreReputation) refreshTasks.push(refreshTheatreReputation());
    if (shouldRefreshBadges) refreshTasks.push(refreshBadges());
    if (refreshTasks.length) {
      logOfflineSync('Refreshing derived remote views after flush', {
        shouldRefreshTurnStats,
        shouldRefreshTheatreReputation,
        shouldRefreshBadges,
      });
      await Promise.all(refreshTasks);
      logOfflineSync('Derived remote views refreshed');
    }
  }, [
    authUserId,
    executeQueuedSupabaseMutation,
    refreshBadges,
    refreshPendingBoostRequests,
    refreshTheatreReputation,
    refreshTurnStats,
  ]);

  const enqueueSupabaseMutation = useCallback(
    (mutation: QueuedSupabaseMutationInput) => {
      logOfflineSync('Enqueue requested', {
        mutation: summarizeQueuedMutation(mutation),
        online: !isNavigatorOffline(),
      });
      enqueueQueuedSupabaseMutation(mutation);
      refreshPendingBoostRequests();
      if (mutation.userId === authUserId && !isNavigatorOffline()) {
        logOfflineSync('Triggering immediate flush after enqueue', {
          mutationKind: mutation.kind,
        });
        void flushQueuedSupabaseMutations();
      }
    },
    [authUserId, flushQueuedSupabaseMutations, refreshPendingBoostRequests]
  );

  const markBadgesSeen = useCallback(async () => {
    const seenAt = Date.now();
    logOfflineSync('Action markBadgesSeen', { seenAt });
    setRemoteBadges((prev) =>
      prev.map((badge) =>
        badge.unlocked && !badge.seenAt ? { ...badge, seenAt } : badge
      )
    );

    if (!supabase || !authUserId) {
      logOfflineSync('markBadgesSeen skipped: missing auth or supabase client', {
        hasSupabaseClient: Boolean(supabase),
        authUserId,
      });
      return;
    }
    const queuedMutation: QueuedSupabaseMutationInput = {
      kind: 'mark_badges_seen',
      userId: authUserId,
      payload: { user_id: authUserId },
    };
    if (isNavigatorOffline()) {
      logOfflineSync('markBadgesSeen queued because browser is offline', {
        authUserId,
      });
      enqueueSupabaseMutation(queuedMutation);
      return;
    }

    await withMobileWatchdog(
      async () => {
        const { error } = await supabase!.rpc('mark_my_badges_seen');
        if (error) {
          console.warn('Supabase mark badges seen failed', error);
          logOfflineSync('markBadgesSeen immediate sync failed, falling back to queue', {
            error: formatSyncError(error),
          }, 'warn');
          enqueueSupabaseMutation(queuedMutation);
          return;
        }
        logOfflineSync('markBadgesSeen synced immediately');
        await refreshBadges();
      },
      {
        operation: 'markBadgesSeen',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.markBadgesSeen,
        title: 'Conferma badge lenta',
        message: 'La sincronizzazione badge sta impiegando troppo tempo.',
      }
    ).catch((error) => {
      console.warn('Supabase mark badges seen failed', error);
      logOfflineSync('markBadgesSeen threw, falling back to queue', {
        error: formatSyncError(error),
      }, 'warn');
      enqueueSupabaseMutation(queuedMutation);
    });
  }, [authUserId, enqueueSupabaseMutation, refreshBadges]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    const restoreSession = async () => {
      await withMobileWatchdog(
        async () => {
          const stored = readStoredSession();
          if (stored) {
            const { data: restoredData, error: restoreError } = await supabase!.auth.setSession({
              access_token: stored.access_token,
              refresh_token: stored.refresh_token,
            });
            if (restoreError || !restoredData.session) {
              persistStoredSession(null);
              await supabase!.auth.signOut();
            }
          }

          const { data } = await supabase!.auth.getSession();
          if (!isMounted) return;

          let stableSession = data.session ?? null;
          if (stableSession?.access_token) {
            const { error: userError } = await supabase!.auth.getUser(stableSession.access_token);
            if (userError) {
              stableSession = null;
              persistStoredSession(null);
              await supabase!.auth.signOut();
            }
          }

          persistStoredSession(stableSession);
          setAuthUserId(stableSession?.user.id ?? null);
          setAuthReady(true);
        },
        {
          operation: 'restoreSession',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.restoreSession,
          title: 'Ripristino sessione lento',
          message: 'Il ripristino della sessione mobile sta impiegando troppo tempo.',
        }
      );
    };

    restoreSession();

    const { data: authListener } = supabase!.auth.onAuthStateChange((_event, session) => {
      persistStoredSession(session ?? null);
      if (!isMounted) return;
      setAuthUserId(session?.user.id ?? null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setHasHydratedRemote(false);
  }, [authUserId]);

  useEffect(() => {
    refreshPendingBoostRequests();
  }, [authUserId, refreshPendingBoostRequests]);

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
      retryIntervalMs: OFFLINE_SYNC_RETRY_INTERVAL_MS,
    });

    const handleOnline = () => {
      logOfflineSync('Browser online event: retrying queued mutations', { authUserId });
      void flushQueuedSupabaseMutations();
    };

    window.addEventListener('online', handleOnline);
    const intervalId = window.setInterval(
      () => {
        const hasQueuedForUser = readQueuedSupabaseMutations().some(
          (entry) => entry.userId === authUserId
        );
        if (!hasQueuedForUser) return;
        logOfflineSync('Periodic retry tick: queued mutations detected', { authUserId });
        void flushQueuedSupabaseMutations();
      },
      OFFLINE_SYNC_RETRY_INTERVAL_MS
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.clearInterval(intervalId);
      logOfflineSync('Online/offline sync listeners stopped', { authUserId });
    };
  }, [authUserId, flushQueuedSupabaseMutations]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !shouldMirrorOfflineSyncLogsToServer()) return;
    void flushMirroredClientLogsToServer();
  }, [authUserId, authReady, flushMirroredClientLogsToServer]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !shouldMirrorOfflineSyncLogsToServer()) return;
    if (typeof window === 'undefined') return;
    console.info(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror listeners started`, {
      retryIntervalMs: OFFLINE_SYNC_SERVER_LOG_RETRY_INTERVAL_MS,
      batchSize: OFFLINE_SYNC_SERVER_LOG_BATCH_SIZE,
    });

    const handleOnline = () => {
      console.info(`${OFFLINE_SYNC_LOG_PREFIX} Browser online: retrying server log mirror`);
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
      console.info(`${OFFLINE_SYNC_LOG_PREFIX} Server log mirror listeners stopped`);
    };
  }, [flushMirroredClientLogsToServer]);

  const refreshEventPlanning = useCallback(
    async (catalogEvents: GameEvent[]) => {
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        setEventPlansLoading(false);
        setFollowedEventsLoading(false);
        syncLocalEventPlanning(state.eventPlans);
        return;
      }
      await withMobileWatchdog(
        async () => {
          setEventPlansLoading(true);
          setFollowedEventsLoading(true);
          try {
            const { data, error } = await supabase!.rpc('get_my_planned_participations');
            if (!error && data) {
              const rows = data as PlannedParticipationRpcRow[];
              const mappedPlans = rows
                .map((row) => {
                  const roleId = resolveEventPlanningRoleId(
                    row.role_id,
                    state.profile.roleId
                  );
                  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
                  return {
                    eventId: row.event_id,
                    roleId,
                    status: resolveEventPlanningStatus(row.status),
                    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
                  };
                })
                .filter((plan) => plan.eventId);

              const mappedEvents = rows
                .map((row) => {
                  const catalogEvent = catalogEvents.find((event) => event.id === row.event_id);
                  if (catalogEvent) return catalogEvent;

                  return {
                    id: row.event_id,
                    name: normalizeText(row.event_name),
                    theatre: normalizeText(row.theatre),
                    date: normalizeText(row.event_date),
                    time: normalizeText(row.event_time),
                    genre: 'Evento',
                    baseRewards: {
                      xp: 0,
                      reputation: 0,
                      cachet: 0,
                    },
                  } as GameEvent;
                })
                .filter((event) => Boolean(event.id && event.name));

              setState((prev) => ({
                ...prev,
                eventPlans: mappedPlans,
              }));
              setEventPlans(mappedPlans);
              setFollowedEvents(sortEventsForPlanning(mappedEvents));
            }
          } finally {
            setFollowedEventsLoading(false);
            setEventPlansLoading(false);
          }
        },
        {
          operation: 'refreshEventPlanning',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.refreshEventPlanning,
          title: 'Pianificazione eventi lenta',
          message: 'Il refresh della pianificazione eventi sta impiegando troppo tempo.',
        }
      );
    },
    [authUserId, state.eventPlans, state.profile.roleId, syncLocalEventPlanning]
  );

  const refreshShopCatalog = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      setShopCatalog(DEFAULT_SHOP_CATALOG);
      return;
    }

    await withMobileWatchdog(
      async () => {
        setShopCatalogLoading(true);
        try {
          const { data, error } = await supabase!
            .from('shop_catalog')
            .select('code,title,description,category,cost_cachet,effect_value,max_purchases_per_user,active,metadata')
            .eq('active', true)
            .order('cost_cachet', { ascending: true });
          if (error) {
            console.warn('Supabase shop catalog fetch failed', error);
            setShopCatalog(DEFAULT_SHOP_CATALOG);
            return;
          }
          setShopCatalog(parseShopCatalogRows(data));
        } finally {
          setShopCatalogLoading(false);
        }
      },
      {
        operation: 'loadShopCatalog',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.loadShopCatalog,
        title: 'Shop lento',
        message: 'Il caricamento del catalogo shop sta impiegando troppo tempo.',
      }
    );
  }, [authUserId]);

  const refreshActivitySlotsStatus = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      const totalSlots = 3 + state.profile.extraActivitySlots;
      setActivitySlotsStatus({
        usedToday: 0,
        totalSlots,
        remainingSlots: totalSlots,
      });
      return;
    }

    await withMobileWatchdog(
      async () => {
        setActivitySlotsLoading(true);
        try {
          const { data, error } = await supabase!.rpc('get_activity_slots_status');
          if (error) {
            console.warn('Supabase activity slots status fetch failed', error);
            return;
          }
          const row = parseActivitySlotsRpcRow(data);
          if (!row) return;
          const totalSlots = Number.isFinite(row.total_slots) ? row.total_slots : 3;
          const usedToday = Number.isFinite(row.used_today) ? row.used_today : 0;
          const remainingSlots = Number.isFinite(row.remaining_slots)
            ? row.remaining_slots
            : Math.max(0, totalSlots - usedToday);
          setActivitySlotsStatus({
            usedToday,
            totalSlots,
            remainingSlots: Math.max(0, remainingSlots),
          });
        } finally {
          setActivitySlotsLoading(false);
        }
      },
      {
        operation: 'loadActivitySlots',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.loadActivitySlots,
        title: 'Slot attività lenti',
        message: 'Il controllo slot attività sta impiegando troppo tempo.',
      }
    );
  }, [authUserId, state.profile.extraActivitySlots]);

  const applyFeatureFlagsSnapshot = useCallback(
    (
      nextFlags: MobileFeatureFlagsState,
      source: MobileFeatureFlagsSource,
      persistCache = false,
      cacheSnapshot?: MobileFeatureFlagsState
    ) => {
      setFeatureFlags({ ...nextFlags });
      setFeatureFlagsSource(source);
      setFeatureFlagsReady(true);
      if (persistCache) {
        writeMobileFeatureFlagsCache(cacheSnapshot ?? nextFlags);
      }
    },
    []
  );

  const refreshFeatureFlags = useCallback(async () => {
    const vercelOverrides = readVercelMobileFeatureFlagOverrides();
    const hasVercelOverrides = Object.keys(vercelOverrides).length > 0;
    const sourceWithVercel = (baseSource: Exclude<MobileFeatureFlagsSource, 'vercel'>): MobileFeatureFlagsSource =>
      hasVercelOverrides ? 'vercel' : baseSource;

    const envOverrides = readEnvFeatureFlagOverrides();

    const applyRuntimeOverrides = (baseline: MobileFeatureFlagsState): MobileFeatureFlagsState => {
      let next = applyMobileFeatureFlagOverrides(baseline, envOverrides);
      return applyMobileFeatureFlagOverrides(next, vercelOverrides);
    };

    if (!isSupabaseConfigured || !supabase) {
      applyFeatureFlagsSnapshot(
        applyRuntimeOverrides(MOBILE_FEATURE_FLAGS_DEFAULTS),
        sourceWithVercel('default')
      );
      return;
    }

    const cachedFlags = readMobileFeatureFlagsCache();
    if (!authUserId) {
      if (cachedFlags) {
        applyFeatureFlagsSnapshot(
          applyRuntimeOverrides(cachedFlags),
          sourceWithVercel('cache')
        );
        return;
      }
      applyFeatureFlagsSnapshot(
        applyRuntimeOverrides(MOBILE_FEATURE_FLAGS_DEFAULTS),
        sourceWithVercel('default')
      );
      return;
    }

    if (cachedFlags) {
      setFeatureFlags(applyRuntimeOverrides(cachedFlags));
      setFeatureFlagsSource(sourceWithVercel('cache'));
    } else {
      setFeatureFlags(applyRuntimeOverrides(MOBILE_FEATURE_FLAGS_DEFAULTS));
      setFeatureFlagsSource(sourceWithVercel('default'));
    }
    setFeatureFlagsReady(false);

    await withMobileWatchdog(
      async () => {
        const { data, error } = await supabase!
          .from('mobile_feature_flags')
          .select('key,enabled');
        if (error) {
          console.warn('Supabase feature flags fetch failed', error);
          if (cachedFlags) {
            applyFeatureFlagsSnapshot(
              applyRuntimeOverrides(cachedFlags),
              sourceWithVercel('cache')
            );
            return;
          }
          applyFeatureFlagsSnapshot(
            applyRuntimeOverrides(MOBILE_FEATURE_FLAGS_DEFAULTS),
            sourceWithVercel('default')
          );
          return;
        }

        const parsed = normalizeMobileFeatureFlags(data);
        if (!parsed) {
          if (cachedFlags) {
            applyFeatureFlagsSnapshot(
              applyRuntimeOverrides(cachedFlags),
              sourceWithVercel('cache')
            );
            return;
          }
          applyFeatureFlagsSnapshot(
            applyRuntimeOverrides(MOBILE_FEATURE_FLAGS_DEFAULTS),
            sourceWithVercel('default')
          );
          return;
        }

        applyFeatureFlagsSnapshot(
          applyRuntimeOverrides(parsed),
          sourceWithVercel('remote'),
          true,
          parsed
        );
      },
      {
        operation: 'loadFeatureFlags',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.loadFeatureFlags,
        title: 'Feature flag lente',
        message: 'Il caricamento delle feature flag mobile sta impiegando troppo tempo.',
      }
    ).catch(() => {
      if (cachedFlags) {
        applyFeatureFlagsSnapshot(
          applyRuntimeOverrides(cachedFlags),
          sourceWithVercel('cache')
        );
        return;
      }
      applyFeatureFlagsSnapshot(
        applyRuntimeOverrides(MOBILE_FEATURE_FLAGS_DEFAULTS),
        sourceWithVercel('default')
      );
    });
  }, [applyFeatureFlagsSnapshot, authUserId]);

  useEffect(() => {
    void refreshFeatureFlags();
  }, [authUserId, refreshFeatureFlags]);

  const planEvent = useCallback(
    async (eventId: string, roleId: RoleId) => {
      const event = catalog.events.find((item) => item.id === eventId);
      if (!event) return;

      const nextPlan: EventPlanning = {
        eventId,
        roleId,
        status: 'planned',
        updatedAt: Date.now(),
      };

      logOfflineSync('Action planEvent', { eventId, roleId });
      setState((prev) => ({
        ...prev,
        eventPlans: upsertEventPlan(prev.eventPlans, nextPlan),
      }));
      setEventPlans((prev) => upsertEventPlan(prev, nextPlan));
      setFollowedEvents((prev) => {
        const filtered = prev.filter((item) => item.id !== eventId);
        return sortEventsForPlanning([event, ...filtered]);
      });

      if (!isSupabaseConfigured || !supabase || !authUserId) {
        logOfflineSync('planEvent handled locally only (no remote prerequisites)', {
          eventId,
          roleId,
          isSupabaseConfigured,
          hasSupabaseClient: Boolean(supabase),
          authUserId,
        });
        return;
      }

      const queuedMutation: QueuedSupabaseMutationInput = {
        kind: 'follow_event_insert',
        userId: authUserId,
        payload: {
          user_id: authUserId,
          event_id: eventId,
          planned_role_id: roleId,
          planning_status: 'planned',
        },
      };
      if (isNavigatorOffline()) {
        logOfflineSync('planEvent queued because browser is offline', { eventId, roleId });
        enqueueSupabaseMutation(queuedMutation);
        return;
      }

      await withMobileWatchdog(
        async () => {
          const { error } = await supabase!.rpc('upsert_planned_participation', {
            p_event_id: eventId,
            p_role_id: roleId,
            p_status: 'planned',
            p_notes: null,
          });
          if (error && !isDuplicateSyncError(error)) {
            console.warn('Supabase event planning upsert failed', error);
            logOfflineSync('planEvent immediate sync failed, falling back to queue', {
              eventId,
              roleId,
              error: formatSyncError(error),
            }, 'warn');
            enqueueSupabaseMutation(queuedMutation);
            return;
          }
          logOfflineSync('planEvent synced immediately', { eventId, roleId });
        },
        {
          operation: 'followEvent',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.followEvent,
          title: 'Pianificazione evento lenta',
          message: 'Il salvataggio della pianificazione sta impiegando troppo tempo.',
        }
      ).catch((error) => {
        console.warn('Supabase event planning upsert failed', error);
        logOfflineSync('planEvent threw, falling back to queue', {
          eventId,
          roleId,
          error: formatSyncError(error),
        }, 'warn');
        enqueueSupabaseMutation(queuedMutation);
      });
    },
    [authUserId, catalog.events, enqueueSupabaseMutation]
  );

  const cancelEventPlan = useCallback(
    async (eventId: string) => {
      logOfflineSync('Action cancelEventPlan', { eventId });
      setState((prev) => ({
        ...prev,
        eventPlans: removeEventPlan(prev.eventPlans, eventId),
      }));
      setEventPlans((prev) => removeEventPlan(prev, eventId));
      setFollowedEvents((prev) => prev.filter((item) => item.id !== eventId));
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        logOfflineSync('cancelEventPlan handled locally only (no remote prerequisites)', {
          eventId,
          isSupabaseConfigured,
          hasSupabaseClient: Boolean(supabase),
          authUserId,
        });
        return;
      }

      const queuedMutation: QueuedSupabaseMutationInput = {
        kind: 'follow_event_delete',
        userId: authUserId,
        payload: {
          user_id: authUserId,
          event_id: eventId,
          planned_role_id: state.profile.roleId,
          planning_status: 'planned',
        },
      };
      if (isNavigatorOffline()) {
        logOfflineSync('cancelEventPlan queued because browser is offline', { eventId });
        enqueueSupabaseMutation(queuedMutation);
        return;
      }

      await withMobileWatchdog(
        async () => {
          const { error } = await supabase!.rpc('remove_planned_participation', {
            p_event_id: eventId,
          });
          if (error) {
            console.warn('Supabase cancel event plan failed', error);
            logOfflineSync('cancelEventPlan immediate sync failed, falling back to queue', {
              eventId,
              error: formatSyncError(error),
            }, 'warn');
            enqueueSupabaseMutation(queuedMutation);
            return;
          }
          logOfflineSync('cancelEventPlan synced immediately', { eventId });
        },
        {
          operation: 'unfollowEvent',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.unfollowEvent,
          title: 'Cancellazione pianificazione lenta',
          message: 'La rimozione della pianificazione sta impiegando troppo tempo.',
        }
      ).catch((error) => {
        console.warn('Supabase cancel event plan failed', error);
        logOfflineSync('cancelEventPlan threw, falling back to queue', {
          eventId,
          error: formatSyncError(error),
        }, 'warn');
        enqueueSupabaseMutation(queuedMutation);
      });
    },
    [authUserId, enqueueSupabaseMutation, state.profile.roleId]
  );

  const followEvent = useCallback(
    async (eventId: string) => {
      await planEvent(eventId, state.profile.roleId);
    },
    [planEvent, state.profile.roleId]
  );

  const unfollowEvent = useCallback(
    async (eventId: string) => {
      await cancelEventPlan(eventId);
    },
    [cancelEventPlan]
  );

  const getEventPlan = useCallback(
    (eventId: string) => eventPlans.find((plan) => plan.eventId === eventId) ?? null,
    [eventPlans]
  );

  const isEventFollowed = useCallback(
    (eventId: string) => eventPlans.some((plan) => plan.eventId === eventId),
    [eventPlans]
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) {
      setRemoteTurnStats(null);
      setRemoteBadges([]);
      setRemoteTheatreReputation([]);
      return;
    }
    refreshTurnStats();
    refreshTheatreReputation();
    refreshBadges();
    refreshLeaderboard();
  }, [authUserId, refreshBadges, refreshTheatreReputation, refreshTurnStats]);

  useEffect(() => {
    if (isSupabaseConfigured && supabase && authUserId) return;
    syncLocalEventPlanning(state.eventPlans);
  }, [authUserId, catalog.events, state.eventPlans, syncLocalEventPlanning]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;
    refreshEventPlanning(catalog.events);
  }, [authUserId, catalog.events, refreshEventPlanning]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    const loadCatalog = async () => {
      await withMobileWatchdog(
        async () => {
          const [rolesRes, eventsRes, activitiesRes] = await Promise.all([
            supabase!.from('roles').select('id,name,focus,stats,role_profile'),
            supabase!
              .from('events')
              .select('id,name,theatre,event_date,event_time,genre,base_rewards,focus_role'),
            supabase!
              .from('activities')
              .select('id,title,description,duration,xp_reward,cachet_reward,difficulty'),
          ]);

          if (!isMounted) return;

          const nextRoles =
            rolesRes.error || !rolesRes.data?.length
              ? roles
              : (rolesRes.data as DbRoleRow[]).map((role) => ({
                id: isRoleId(role.id) ? role.id : 'attore',
                name: role.name,
                focus: role.focus,
                stats: {
                  presence: Number(role.stats?.presence ?? 0),
                  precision: Number(role.stats?.precision ?? 0),
                  leadership: Number(role.stats?.leadership ?? 0),
                  creativity: Number(role.stats?.creativity ?? 0),
                },
                profile: normalizeRoleProfile(role.role_profile),
              }));

          const nextEvents =
            eventsRes.error || !eventsRes.data?.length
              ? (isSupabaseConfigured ? [] : import.meta.env.DEV ? events : [])
              : (eventsRes.data as DbEventRow[]).map((event) => ({
                id: event.id,
                name: normalizeText(event.name),
                theatre: normalizeText(event.theatre),
                date: normalizeText(event.event_date),
                time: normalizeText(event.event_time),
                genre: normalizeText(event.genre),
                baseRewards: {
                  xp: Number(event.base_rewards?.xp ?? 0),
                  reputation: Number(event.base_rewards?.reputation ?? 0),
                  cachet: Number(event.base_rewards?.cachet ?? 0),
                },
                focusRole: (event.focus_role ?? undefined) as RoleId | undefined,
              }));

          const nextActivities =
            activitiesRes.error || !activitiesRes.data?.length
              ? import.meta.env.DEV ? activities : []
              : (activitiesRes.data as DbActivityRow[]).map((activity) => ({
                id: activity.id,
                title: activity.title,
                description: activity.description,
                duration: activity.duration,
                xpReward: activity.xp_reward,
                cachetReward: activity.cachet_reward,
                difficulty: activity.difficulty as Activity['difficulty'],
              }));

          setCatalog({
            roles: nextRoles,
            events: nextEvents,
            activities: nextActivities,
          });
          refreshEventPlanning(nextEvents);
        },
        {
          operation: 'loadCatalog',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.loadCatalog,
          title: 'Catalogo mobile lento',
          message: 'Il caricamento del catalogo mobile sta impiegando troppo tempo.',
        }
      );
    };

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;
    let isMounted = true;

    const loadRemoteState = async () => {
      await withMobileWatchdog(
        async () => {
          const [userRes, profileRes, turnsRes] = await Promise.all([
            supabase!.auth.getUser(),
            supabase!.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
            supabase!.from('turns').select('*').eq('user_id', authUserId).order('created_at', { ascending: false }),
          ]);

          if (!isMounted) return;

          if (userRes.error || profileRes.error || turnsRes.error) {
            notifyCriticalError('Non riusciamo a caricare il profilo dal database.', [
              userRes.error,
              profileRes.error,
              turnsRes.error,
            ]);
          }

          let profileRow: DbProfileRow | null = profileRes.data as DbProfileRow | null;

          if (!profileRow && userRes.data?.user?.email) {
            const user = userRes.data.user;
            const displayName = resolveDisplayName({
              name: user.user_metadata?.name,
              metadata: user.user_metadata,
              email: user.email,
              fallback: 'Utente',
            });
            const insertRes = await supabase!
              .from('profiles')
              .insert({
                id: authUserId,
                name: displayName,
                email: user.email,
                role_id: 'attore',
              })
              .select('*')
              .single();
            if (insertRes.error) {
              notifyCriticalError('Non riusciamo a creare il profilo utente.', [insertRes.error]);
            }
            profileRow = insertRes.data ?? null;
          }

          if (!isMounted) return;

          const remoteTurns = Array.isArray(turnsRes.data)
            ? (turnsRes.data as DbTurnRow[]).map((turn) => ({
              id: turn.id,
              eventId: turn.event_id ?? '',
              eventName: normalizeText(turn.event_name),
              theatre: normalizeText(turn.theatre),
              date: normalizeText(turn.event_date),
              time: normalizeText(turn.event_time),
              roleId: isRoleId(turn.role_id) ? turn.role_id : 'attore',
              rewards: {
                xp: Number(turn.rewards?.xp ?? 0),
                reputation: Number(turn.rewards?.reputation ?? 0),
                cachet: Number(turn.rewards?.cachet ?? 0),
              },
              createdAt: turn.created_at ? new Date(turn.created_at).getTime() : Date.now(),
            }))
            : [];

          if (profileRow) {
            const user = userRes.data?.user;
            const parsedLastActivityAt = profileRow.last_activity_at ? new Date(profileRow.last_activity_at).getTime() : NaN;
            setState((prev: GameState) => ({
              profile: {
                ...prev.profile,
                name: resolveDisplayName({
                  name: profileRow.name,
                  metadata: user?.user_metadata,
                  email: profileRow.email ?? user?.email ?? prev.profile.email,
                  fallback: prev.profile.name,
                }),
                email: profileRow.email ?? prev.profile.email,
                roleId: isRoleId(profileRow.role_id) ? profileRow.role_id : prev.profile.roleId,
                level: profileRow.level ?? prev.profile.level,
                xp: profileRow.xp ?? prev.profile.xp,
                xpToNextLevel: profileRow.xp_to_next_level ?? prev.profile.xpToNextLevel,
                xpTotal: profileRow.xp_total ?? prev.profile.xpTotal,
                xpField: profileRow.xp_field ?? prev.profile.xpField,
                reputation: profileRow.reputation ?? prev.profile.reputation,
                cachet: profileRow.cachet ?? prev.profile.cachet,
                tokenAtcl: profileRow.token_atcl ?? prev.profile.tokenAtcl,
                extraActivitySlots:
                  profileRow.extra_activity_slots ?? prev.profile.extraActivitySlots,
                profileImage: profileRow.profile_image ?? prev.profile.profileImage,
                lastActivityAt: Number.isFinite(parsedLastActivityAt)
                  ? parsedLastActivityAt
                  : prev.profile.lastActivityAt,
              },
              eventPlans: prev.eventPlans,
              turns: remoteTurns,
            }));
          }

          if (profileRow || !profileRes.error) {
            setHasHydratedRemote(true);
          }
        },
        {
          operation: 'loadRemoteState',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.loadRemoteState,
          title: 'Stato remoto lento',
          message: 'Il caricamento dello stato remoto mobile sta impiegando troppo tempo.',
        }
      );
    };

    loadRemoteState();

    return () => {
      isMounted = false;
    };
  }, [authUserId]);

  useEffect(() => {
    if (!authUserId) {
      setShopCatalog(DEFAULT_SHOP_CATALOG);
      return;
    }
    void refreshShopCatalog();
  }, [authUserId, refreshShopCatalog]);

  useEffect(() => {
    if (!authUserId) {
      const totalSlots = 3 + state.profile.extraActivitySlots;
      setActivitySlotsStatus({
        usedToday: 0,
        totalSlots,
        remainingSlots: totalSlots,
      });
      return;
    }
    if (!hasHydratedRemote) return;
    void refreshActivitySlotsStatus();
  }, [
    authUserId,
    hasHydratedRemote,
    refreshActivitySlotsStatus,
    state.profile.extraActivitySlots,
  ]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;

    const mapTurnRow = (turn: DbTurnRow): TurnRecord => ({
      id: turn.id,
      eventId: turn.event_id ?? '',
      eventName: normalizeText(turn.event_name),
      theatre: normalizeText(turn.theatre),
      date: normalizeText(turn.event_date),
      time: normalizeText(turn.event_time),
      roleId: isRoleId(turn.role_id) ? turn.role_id : 'attore',
      rewards: {
        xp: Number(turn.rewards?.xp ?? 0),
        reputation: Number(turn.rewards?.reputation ?? 0),
        cachet: Number(turn.rewards?.cachet ?? 0),
      },
      createdAt: turn.created_at ? new Date(turn.created_at).getTime() : Date.now(),
    });

    const channel = supabase
      .channel(`tdp-mobile-${authUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${authUserId}` },
        (payload) => {
          if (!payload.new) return;
          const profile = payload.new as DbProfileRow;
          setState((prev: GameState) => ({
            ...prev,
            profile: {
              ...prev.profile,
              name: resolveDisplayName({
                name: profile.name,
                email: profile.email ?? prev.profile.email,
                fallback: prev.profile.name,
              }),
              email: profile.email ?? prev.profile.email,
              roleId: isRoleId(profile.role_id) ? profile.role_id : prev.profile.roleId,
              level: profile.level ?? prev.profile.level,
              xp: profile.xp ?? prev.profile.xp,
              xpToNextLevel: profile.xp_to_next_level ?? prev.profile.xpToNextLevel,
              xpTotal: profile.xp_total ?? prev.profile.xpTotal,
              xpField: profile.xp_field ?? prev.profile.xpField,
              reputation: profile.reputation ?? prev.profile.reputation,
              cachet: profile.cachet ?? prev.profile.cachet,
              tokenAtcl: profile.token_atcl ?? prev.profile.tokenAtcl,
              extraActivitySlots:
                profile.extra_activity_slots ?? prev.profile.extraActivitySlots,
              profileImage: profile.profile_image ?? prev.profile.profileImage,
              lastActivityAt: profile.last_activity_at ? new Date(profile.last_activity_at).getTime() : prev.profile.lastActivityAt,
            },
          }));
          setHasHydratedRemote(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turns', filter: `user_id=eq.${authUserId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const nextTurn = mapTurnRow(payload.new as DbTurnRow);
            setState((prev: GameState) => {
              if (prev.turns.some((turn: TurnRecord) => turn.id === nextTurn.id)) {
                return prev;
              }
              const merged = [nextTurn, ...prev.turns].sort((a: TurnRecord, b: TurnRecord) => b.createdAt - a.createdAt);
              return { ...prev, turns: merged.slice(0, MAX_TURNS) };
            });
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const nextTurn = mapTurnRow(payload.new as DbTurnRow);
            setState((prev: GameState) => ({
              ...prev,
              turns: prev.turns
                .map((turn: TurnRecord) => (turn.id === nextTurn.id ? nextTurn : turn))
                .sort((a: TurnRecord, b: TurnRecord) => b.createdAt - a.createdAt),
            }));
          }

          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as { id?: string }).id;
            if (!deletedId) return;
            setState((prev: GameState) => ({
              ...prev,
              turns: prev.turns.filter((turn: TurnRecord) => turn.id !== deletedId),
            }));
          }

          refreshTurnStats();
          refreshTheatreReputation();
          refreshBadges();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshBadges();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planned_participations', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshEventPlanning(catalog.events);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_completions', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshActivitySlotsStatus();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_catalog' },
        () => {
          refreshShopCatalog();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mobile_feature_flags' },
        () => {
          void refreshFeatureFlags();
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [
    authUserId,
    catalog.events,
    refreshBadges,
    refreshActivitySlotsStatus,
    refreshEventPlanning,
    refreshFeatureFlags,
    refreshShopCatalog,
    refreshTheatreReputation,
    refreshTurnStats,
  ]);

  const persistProfile = useCallback(
    (profile: PlayerProfile) => {
      if (!supabase || !authUserId || !hasHydratedRemote) {
        logOfflineSync('persistProfile skipped: remote state not ready', {
          hasSupabaseClient: Boolean(supabase),
          authUserId,
          hasHydratedRemote,
        });
        return;
      }
      logOfflineSync('Action persistProfile', {
        authUserId,
        roleId: profile.roleId,
        level: profile.level,
      });
      const payload = buildProfileUpsertPayload(authUserId, profile);
      const queuedMutation: QueuedSupabaseMutationInput = {
        kind: 'profile_upsert',
        userId: authUserId,
        payload,
      };
      if (isNavigatorOffline()) {
        logOfflineSync('persistProfile queued because browser is offline', { authUserId });
        enqueueSupabaseMutation(queuedMutation);
        return;
      }

      void withMobileWatchdog(
        async () => {
          const { error } = await supabase!
            .from('profiles')
            .upsert(payload, { onConflict: 'id' });
          if (error) {
            console.warn('Supabase profile upsert failed', error);
            logOfflineSync('persistProfile immediate sync failed, falling back to queue', {
              error: formatSyncError(error),
              authUserId,
            }, 'warn');
            enqueueSupabaseMutation(queuedMutation);
            return;
          }
          logOfflineSync('persistProfile synced immediately', {
            authUserId,
            roleId: profile.roleId,
            level: profile.level,
          });
        },
        {
          operation: 'persistProfile',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.persistProfile,
          title: 'Sync profilo lenta',
          message: 'La sincronizzazione del profilo mobile sta impiegando troppo tempo.',
        }
      ).catch((error) => {
        console.warn('Supabase profile upsert failed', error);
        logOfflineSync('persistProfile threw, falling back to queue', {
          error: formatSyncError(error),
          authUserId,
        }, 'warn');
        enqueueSupabaseMutation(queuedMutation);
      });
    },
    [authUserId, enqueueSupabaseMutation, hasHydratedRemote]
  );

  const updateProfile = useCallback(
    (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId' | 'profileImage'>>) => {
      let nextProfile: PlayerProfile | null = null;
      setState((prev: GameState) => {
        const nextRole =
          updates.roleId && catalog.roles.some((role: Role) => role.id === updates.roleId)
            ? updates.roleId
            : prev.profile.roleId;
        nextProfile = { ...prev.profile, ...updates, roleId: nextRole ?? prev.profile.roleId };
        return {
          ...prev,
          profile: nextProfile,
        };
      });
      if (nextProfile) {
        persistProfile(nextProfile);
      }
    },
    [catalog.roles, persistProfile]
  );

  const registerTurn = useCallback(
    async ({
      eventId,
      roleId,
      eventOverride,
      boostRequested = false,
    }: RegisterTurnInput): Promise<RegisterTurnResult> => {
      const event = eventOverride ?? catalog.events.find((item) => item.id === eventId);
      if (!event) {
        logOfflineSync('registerTurn aborted: event not found', { eventId, roleId }, 'warn');
        return { ok: false, error: 'Evento non trovato.' };
      }

      if (!featureFlags['mobile.action.turn_submit']) {
        logOfflineSync('registerTurn aborted: feature disabled', { eventId, roleId, feature: 'mobile.action.turn_submit' }, 'warn');
        return { ok: false, error: 'Registrazione turni temporaneamente disattivata.' };
      }

      if (boostRequested && !featureFlags['mobile.action.turn_boost']) {
        logOfflineSync('registerTurn aborted: boost feature disabled', { eventId, roleId, feature: 'mobile.action.turn_boost' }, 'warn');
        return { ok: false, error: 'Boost turno temporaneamente disattivato.' };
      }

      logOfflineSync('Action registerTurn', {
        eventId,
        roleId,
        boostRequested,
      });

      const turnId =
        globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `turn-${Date.now()}`;

      const geofenceValidationEnabled = featureFlags['mobile.action.turn_geofence'];
      const requiresServerGeolocation = geofenceValidationEnabled
        && isSupabaseConfigured
        && Boolean(supabase)
        && Boolean(authUserId);
      const geolocationSnapshot = requiresServerGeolocation
        ? await readTurnGeolocationSnapshot()
        : null;

      // Se la geolocalizzazione è richiesta ma non disponibile, procedi comunque con un avviso
      if (requiresServerGeolocation && !geolocationSnapshot) {
        console.warn('Geolocalizzazione non disponibile - procedo senza validazione geofence');
      }

      const turnRegisterPayload: TurnRegisterPayload = {
        id: turnId,
        user_id: authUserId ?? '',
        event_id: event.id,
        event_name: event.name,
        theatre: event.theatre,
        event_date: event.date,
        event_time: event.time,
        role_id: roleId,
        boost_requested: Boolean(boostRequested),
        sync_status: 'pending',
        checkin_latitude: geolocationSnapshot?.latitude ?? null,
        checkin_longitude: geolocationSnapshot?.longitude ?? null,
        checkin_accuracy_m: geolocationSnapshot?.accuracyM ?? null,
      };

      const pendingTurnRecord = buildTurnRecordFromPayload(
        turnRegisterPayload,
        computeTurnRewards(event, roleId),
        'pending',
        false,
        null
      );

      if (!isSupabaseConfigured || !supabase || !authUserId) {
        let localBoostApplied = false;
        let localBoostRejectionReason: string | null = null;
        let localRewards = computeTurnRewards(event, roleId);
        let nextTokenAtcl = 0;
        let localSyncStatus: TurnSyncStatus = 'synced';
        let localTurnRecord: TurnRecord | null = null;
        setState((prev: GameState) => {
          let workingToken = prev.profile.tokenAtcl;
          if (boostRequested) {
            if (workingToken > 0) {
              localBoostApplied = true;
              workingToken -= 1;
              localRewards = {
                ...localRewards,
                xp: Math.ceil(localRewards.xp * 1.1),
                cachet: Math.ceil(localRewards.cachet * 1.1),
              };
            } else {
              localBoostRejectionReason = 'insufficient_token_balance';
            }
          }
          workingToken += 1;
          nextTokenAtcl = workingToken;
          localSyncStatus = boostRequested && !localBoostApplied ? 'failed_boost_fallback' : 'synced';
          localTurnRecord = buildTurnRecordFromPayload(
            turnRegisterPayload,
            localRewards,
            localSyncStatus,
            localBoostApplied,
            localBoostRejectionReason
          );
          const rewardedProfile = applyRewards(prev.profile, localRewards, 'turn');
          return {
            profile: {
              ...rewardedProfile,
              tokenAtcl: nextTokenAtcl,
            },
            eventPlans: prev.eventPlans,
            turns: localTurnRecord ? [localTurnRecord, ...prev.turns].slice(0, MAX_TURNS) : prev.turns,
          };
        });
        if (!localTurnRecord) {
          return { ok: false, error: 'Impossibile registrare il turno in locale.' };
        }
        setTurnSyncFeedback({
          syncStatus: localSyncStatus,
          boostRequested,
          boostApplied: localBoostApplied,
          boostRejectionReason: localBoostRejectionReason,
          eventName: event.name,
          createdAt: Date.now(),
          geolocationAvailable: Boolean(geolocationSnapshot),
        });
        return {
          ok: true,
          syncStatus: localSyncStatus,
          boostRequested,
          boostApplied: localBoostApplied,
          boostRejectionReason: localBoostRejectionReason,
          rewards: localRewards,
          tokenBalanceAfter: nextTokenAtcl,
          turn: localTurnRecord,
        };
      }

      turnRegisterPayload.user_id = authUserId;
      const queuedMutation: QueuedSupabaseMutationInput = {
        kind: 'turn_register',
        userId: authUserId,
        payload: turnRegisterPayload,
      };

      if (isNavigatorOffline()) {
        logOfflineSync('registerTurn queued because browser is offline', {
          turnId,
          eventId: event.id,
          boostRequested,
        });
        enqueueSupabaseMutation(queuedMutation);
        setTurnSyncFeedback({
          syncStatus: 'pending',
          boostRequested,
          boostApplied: false,
          boostRejectionReason: null,
          eventName: event.name,
          createdAt: Date.now(),
          geolocationAvailable: Boolean(geolocationSnapshot),
        });
        return {
          ok: true,
          syncStatus: 'pending',
          boostRequested,
          boostApplied: false,
          boostRejectionReason: null,
          rewards: pendingTurnRecord.rewards,
          tokenBalanceAfter: null,
          turn: pendingTurnRecord,
        };
      }

      try {
        const rpcResponse = await withMobileWatchdog(
          async () => {
            const { data, error } = await supabase!.rpc('register_turn_with_token_boost', {
              p_event_id: event.id,
              p_role_id: roleId,
              p_client_action_id: turnId,
              p_boost_requested: boostRequested,
              p_checkin_latitude: geolocationSnapshot?.latitude ?? null,
              p_checkin_longitude: geolocationSnapshot?.longitude ?? null,
              p_checkin_accuracy_m: geolocationSnapshot?.accuracyM ?? null,
            });
            if (error) throw error;
            const rpcRow = parseTurnRegistrationRpcRow(data);
            if (!rpcRow) throw new Error('Risposta RPC non valida');
            return rpcRow;
          },
          {
            operation: 'registerTurnInsert',
            timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.registerTurnInsert,
            title: 'Registrazione turno lenta',
            message: 'La registrazione del turno sta impiegando troppo tempo.',
          }
        );

        const syncStatus = resolveTurnSyncStatusFromRpc(rpcResponse);
        applyTurnRegistrationResult(turnRegisterPayload, rpcResponse, syncStatus, Boolean(geolocationSnapshot));
        logOfflineSync('registerTurn synced immediately via RPC', {
          turnId,
          eventId: event.id,
          boostRequested,
          boostApplied: rpcResponse.boost_applied,
          turnRegistered: rpcResponse.turn_registered,
        });
        return {
          ok: true,
          syncStatus,
          boostRequested: rpcResponse.boost_requested,
          boostApplied: rpcResponse.boost_applied,
          boostRejectionReason: rpcResponse.boost_rejection_reason,
          rewards: rpcResponse.rewards_applied,
          tokenBalanceAfter: rpcResponse.token_balance_after,
          turn: buildTurnRecordFromPayload(
            turnRegisterPayload,
            rpcResponse.rewards_applied,
            syncStatus,
            rpcResponse.boost_applied,
            rpcResponse.boost_rejection_reason
          ),
        };
      } catch (error) {
        const errorMessage = localizeTurnRegistrationError(error);
        if (!shouldRetrySyncError(error)) {
          logOfflineSync('registerTurn failed with non-retryable error', {
            turnId,
            eventId: event.id,
            boostRequested,
            error: errorMessage,
          }, 'warn');
          return {
            ok: false,
            error: errorMessage || 'Impossibile registrare il turno.',
          };
        }

        logOfflineSync('registerTurn immediate sync failed, falling back to queue', {
          turnId,
          eventId: event.id,
          boostRequested,
          error: errorMessage,
        }, 'warn');
        enqueueSupabaseMutation(queuedMutation);
        setTurnSyncFeedback({
          syncStatus: 'pending',
          boostRequested,
          boostApplied: false,
          boostRejectionReason: null,
          eventName: event.name,
          createdAt: Date.now(),
          geolocationAvailable: Boolean(geolocationSnapshot),
        });
        return {
          ok: true,
          syncStatus: 'pending',
          boostRequested,
          boostApplied: false,
          boostRejectionReason: null,
          rewards: pendingTurnRecord.rewards,
          tokenBalanceAfter: null,
          turn: pendingTurnRecord,
        };
      }
    },
    [
      authUserId,
      catalog.events,
      enqueueSupabaseMutation,
      featureFlags,
      applyTurnRegistrationResult,
    ]
  );

  const purchaseShopItem = useCallback(
    async (itemCode: string, targetTheatre?: string | null): Promise<ShopPurchaseResult> => {
      if (!featureFlags['mobile.action.shop_purchase']) {
        return {
          ok: false,
          status: 'error',
          error: 'Acquisti shop temporaneamente disattivati.',
        };
      }
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        return {
          ok: false,
          status: 'error',
          error: 'Shop disponibile solo online.',
        };
      }
      if (isNavigatorOffline()) {
        return {
          ok: false,
          status: 'error',
          error: 'Connessione assente: impossibile acquistare offline.',
        };
      }

      const actionId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `shop-${Date.now()}`;

      try {
        const rpcResponse = await withMobileWatchdog(
          async () => {
            const { data, error } = await supabase!.rpc('purchase_shop_item', {
              p_item_code: itemCode,
              p_client_action_id: actionId,
              p_target_theatre: targetTheatre ?? null,
            });
            if (error) throw error;
            const row = parseShopPurchaseRpcRow(data);
            if (!row) throw new Error('Risposta acquisto shop non valida');
            return row;
          },
          {
            operation: 'shopPurchase',
            timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.shopPurchase,
            title: 'Acquisto shop lento',
            message: 'La conferma acquisto sta impiegando troppo tempo.',
          }
        );

        if (!rpcResponse.purchase_applied) {
          return {
            ok: false,
            status: 'rejected',
            error: 'Acquisto non applicato.',
            rejectionReason: rpcResponse.rejection_reason,
          };
        }

        setState((prev: GameState) => ({
          ...prev,
          profile: {
            ...prev.profile,
            cachet: rpcResponse.cachet_balance_after,
            reputation: rpcResponse.profile_reputation_after,
            extraActivitySlots: rpcResponse.extra_slots_after,
          },
        }));

        void refreshActivitySlotsStatus();
        if (rpcResponse.theatre) {
          void refreshTheatreReputation();
        }

        return {
          ok: true,
          status: rpcResponse.status === 'duplicate' ? 'duplicate' : 'applied',
          cachetBalanceAfter: rpcResponse.cachet_balance_after,
          reputationAfter: rpcResponse.profile_reputation_after,
          extraSlotsAfter: rpcResponse.extra_slots_after,
          theatre: rpcResponse.theatre,
          theatreReputationAfter: rpcResponse.theatre_reputation_after,
          effect: rpcResponse.effect,
        };
      } catch (error) {
        const errorMessage = formatSyncError(error);
        return {
          ok: false,
          status: 'error',
          error: errorMessage || 'Errore durante l acquisto shop.',
        };
      }
    },
    [authUserId, featureFlags, refreshActivitySlotsStatus, refreshTheatreReputation]
  );

  const completeActivity = useCallback(
    async (
      activityId: string,
      telemetry?: ActivityTelemetryInput
    ): Promise<CompleteActivityResult> => {
      if (!featureFlags['mobile.action.activity_complete']) {
        return { ok: false, error: 'Completamento attivita temporaneamente disattivato.' };
      }
      const activity = catalog.activities.find((item) => item.id === activityId);
      if (!activity) {
        logOfflineSync('completeActivity aborted: activity not found', { activityId }, 'warn');
        return { ok: false, error: 'Attività non trovata.' };
      }

      if (!isSupabaseConfigured || !supabase || !authUserId) {
        return { ok: false, error: 'Attività disponibile solo online.' };
      }

      if (isNavigatorOffline()) {
        return { ok: false, error: 'Connessione assente: sincronizzazione attività non disponibile.' };
      }

      logOfflineSync('Action completeActivity', { activityId, telemetry });
      const completionId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `activity-${Date.now()}`;

      try {
        const rpcResponse = await withMobileWatchdog(
          async () => {
            const { data, error } = await supabase!.rpc('complete_activity_with_slots', {
              p_activity_id: activity.id,
              p_client_action_id: completionId,
              p_score: telemetry?.score ?? null,
              p_rating: telemetry?.rating ?? null,
              p_attempts: telemetry?.attempts ?? 1,
              p_duration_ms: telemetry?.durationMs ?? null,
            });
            if (error) throw error;
            const row = parseActivityCompletionRpcRow(data);
            if (!row) throw new Error('Risposta activity RPC non valida');
            return row;
          },
          {
            operation: 'completeActivityRpc',
            timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.completeActivityRpc,
            title: 'Registrazione attività lenta',
            message: 'La registrazione attività sta impiegando troppo tempo.',
          }
        );

        const slotsUsedToday = Number.isFinite(rpcResponse.slots_used_today)
          ? rpcResponse.slots_used_today
          : 0;
        const slotsTotal = Number.isFinite(rpcResponse.slots_total)
          ? rpcResponse.slots_total
          : 3;

        setActivitySlotsStatus({
          usedToday: slotsUsedToday,
          totalSlots: slotsTotal,
          remainingSlots: Math.max(0, slotsTotal - slotsUsedToday),
        });

        if (!rpcResponse.activity_registered) {
          return {
            ok: false,
            error: 'Limite giornaliero attività raggiunto.',
            rejectionReason: rpcResponse.rejection_reason,
            slotsUsedToday,
            slotsTotal,
          };
        }

        const rewards = rpcResponse.rewards_applied;
        setState((prev: GameState) => {
          const profileAfterRewards =
            rpcResponse.status === 'duplicate'
              ? prev.profile
              : applyRewards(prev.profile, rewards, 'activity');
          return {
            ...prev,
            profile: {
              ...profileAfterRewards,
              cachet: rpcResponse.cachet_balance_after,
              reputation: rpcResponse.reputation_after,
            },
          };
        });

        void refreshBadges();

        return {
          ok: true,
          activity,
          rewards,
          slotsUsedToday,
          slotsTotal,
          cachetBalanceAfter: rpcResponse.cachet_balance_after,
          reputationAfter: rpcResponse.reputation_after,
        };
      } catch (error) {
        const errorMessage = formatSyncError(error);
        return {
          ok: false,
          error: errorMessage || 'Errore durante la registrazione attività.',
        };
      }
    },
    [authUserId, catalog.activities, featureFlags, refreshBadges]
  );

  const resetProgress = useCallback(async () => {
    logOfflineSync('Action resetProgress');
    await withMobileWatchdog(
      async () => {
        let shouldQueueReset = false;
        if (isSupabaseConfigured && supabase && authUserId) {
          if (isNavigatorOffline()) {
            logOfflineSync('resetProgress queued because browser is offline', {
              authUserId,
            });
            shouldQueueReset = true;
          } else {
            const { error } = await supabase.rpc('reset_my_progress');
            if (error) {
              console.warn('Supabase reset progress failed', error);
              logOfflineSync('resetProgress immediate sync failed, falling back to queue', {
                authUserId,
                error: formatSyncError(error),
              }, 'warn');
              shouldQueueReset = true;
            } else {
              logOfflineSync('resetProgress synced immediately', { authUserId });
            }
          }
        }

        if (shouldQueueReset && authUserId) {
          enqueueSupabaseMutation({
            kind: 'reset_progress',
            userId: authUserId,
            payload: { user_id: authUserId },
          });
        }

        setState((prev: GameState) => ({
          ...prev,
          profile: {
            ...prev.profile,
            roleId: 'attore',
            level: 1,
            xp: 0,
            xpToNextLevel: 1000,
            xpTotal: 0,
            xpField: 0,
            reputation: 0,
            cachet: 0,
            tokenAtcl: 0,
            extraActivitySlots: 0,
          },
          turns: [],
        }));

        setRemoteTurnStats(null);
        setRemoteTheatreReputation([]);
        setRemoteBadges([]);
        setActivitySlotsStatus({
          usedToday: 0,
          totalSlots: 3,
          remainingSlots: 3,
        });

        if (isSupabaseConfigured && supabase && authUserId && !shouldQueueReset) {
          await Promise.all([refreshTurnStats(), refreshTheatreReputation(), refreshBadges()]);
        }
      },
      {
        operation: 'resetProgress',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.resetProgress,
        title: 'Reset progress lento',
        message: 'Il reset del progress mobile sta impiegando troppo tempo.',
      }
    );
  }, [
    authUserId,
    enqueueSupabaseMutation,
    refreshBadges,
    refreshTheatreReputation,
    refreshTurnStats,
  ]);

  const changePassword = useCallback(
    async (newPassword: string, currentPassword?: string) => {
      await withMobileWatchdog(
        async () => {
          if (!isSupabaseConfigured || !supabase) {
            throw new Error('Supabase non configurato');
          }
          if (!authUserId) {
            throw new Error('Devi essere autenticato per cambiare la password');
          }

          if (currentPassword) {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            const email = sessionData.session?.user.email;
            if (!email) {
              throw new Error('Email mancante');
            }
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password: currentPassword,
            });
            if (signInError) {
              throw new Error('Password attuale non valida');
            }
          }

          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
        },
        {
          operation: 'changePassword',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.changePassword,
          title: 'Cambio password lento',
          message: 'Il cambio password sta impiegando troppo tempo.',
        }
      );
    },
    [authUserId]
  );

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    await withMobileWatchdog(
      async () => {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error('Supabase non configurato');
        }
        if (!email) {
          throw new Error('Email mancante');
        }

        const redirectToFromEnv = import.meta.env.VITE_AUTH_REDIRECT_TO;
        const redirectTo =
          typeof redirectToFromEnv === 'string' && redirectToFromEnv.trim()
            ? redirectToFromEnv.trim()
            : typeof window !== 'undefined'
              ? `${window.location.origin}${window.location.pathname}`
              : undefined;

        const { error } = await supabase.auth.resetPasswordForEmail(
          email,
          redirectTo ? { redirectTo } : undefined
        );
        if (error) throw error;
      },
      {
        operation: 'sendPasswordResetEmail',
        timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.sendPasswordResetEmail,
        title: 'Reset password lento',
        message: 'L invio email per il reset password sta impiegando troppo tempo.',
      }
    );
  }, []);

  const clearTurnSyncFeedback = useCallback(() => {
    setTurnSyncFeedback(null);
  }, []);

  const isFeatureEnabled = useCallback(
    (key: MobileFeatureFlagKey) => Boolean(featureFlags[key]),
    [featureFlags]
  );

  const resetState = useCallback(() => {
    const next = createDefaultState();
    setState(next);
    setEventPlans([]);
    setEventPlansLoading(false);
    setFollowedEvents([]);
    setFollowedEventsLoading(false);
    setPendingBoostRequests(0);
    setTurnSyncFeedback(null);
    setFeatureFlags({ ...MOBILE_FEATURE_FLAGS_DEFAULTS });
    setFeatureFlagsSource('default');
    setFeatureFlagsReady(true);
    const totalSlots = 3 + next.profile.extraActivitySlots;
    setActivitySlotsStatus({
      usedToday: 0,
      totalSlots,
      remainingSlots: totalSlots,
    });
  }, []);


  const value = useMemo<GameContextValue>(
    () => ({
      authUserId,
      authReady,
      hasHydratedRemote,
      state,
      roles: catalog.roles,
      events: catalog.events,
      activities: catalog.activities,
      turnStats,
      statsLoading,
      theatreReputation,
      theatreReputationLoading,
      leaderboard,
      leaderboardLoading,
      refreshLeaderboard,
      badges,
      badgesLoading,
      featureFlags,
      featureFlagsReady,
      featureFlagsSource,
      isFeatureEnabled,
      eventPlans,
      eventPlansLoading,
      followedEvents,
      followedEventsLoading,
      shopCatalog,
      shopCatalogLoading,
      refreshShopCatalog,
      purchaseShopItem,
      activitySlotsStatus,
      activitySlotsLoading,
      refreshActivitySlotsStatus,
      getEventPlan,
      planEvent,
      cancelEventPlan,
      followEvent,
      unfollowEvent,
      isEventFollowed,
      markBadgesSeen,
      updateProfile,
      registerTurn,
      pendingBoostRequests,
      turnSyncFeedback,
      clearTurnSyncFeedback,
      completeActivity,
      resetProgress,
      changePassword,
      sendPasswordResetEmail,
      resetState,
    }),
    [
      authUserId,
      authReady,
      hasHydratedRemote,
      state,
      catalog,
      turnStats,
      statsLoading,
      theatreReputation,
      theatreReputationLoading,
      leaderboard,
      leaderboardLoading,
      refreshLeaderboard,
      badges,
      badgesLoading,
      featureFlags,
      featureFlagsReady,
      featureFlagsSource,
      isFeatureEnabled,
      eventPlans,
      eventPlansLoading,
      followedEvents,
      followedEventsLoading,
      shopCatalog,
      shopCatalogLoading,
      refreshShopCatalog,
      purchaseShopItem,
      activitySlotsStatus,
      activitySlotsLoading,
      refreshActivitySlotsStatus,
      getEventPlan,
      planEvent,
      cancelEventPlan,
      followEvent,
      unfollowEvent,
      isEventFollowed,
      markBadgesSeen,
      updateProfile,
      registerTurn,
      pendingBoostRequests,
      turnSyncFeedback,
      clearTurnSyncFeedback,
      completeActivity,
      resetProgress,
      changePassword,
      sendPasswordResetEmail,
      resetState,
    ]
  );

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return ctx;
}
