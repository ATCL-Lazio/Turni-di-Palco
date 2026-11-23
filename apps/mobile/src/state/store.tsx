import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  LEGACY_SUPABASE_SESSION_ID_KEY,
  LEGACY_SUPABASE_SESSION_KEY,
  SUPABASE_SESSION_ID_KEY,
  SUPABASE_SESSION_KEY,
} from '../lib/auth-storage';
import { resolveDisplayName } from '../lib/profile-utils';
import { COOKIE_CONSENT_KEY, GEO_CONSENT_KEY } from '../constants/privacy';
import { clearLocalActivationStores } from '../services/ticket-activation';
import type { CourseSkill } from '../gameplay/courses';
import {
  applyCourseCompletion,
  applyCourseStart,
  checkCourseCompletion,
  checkCourseStart,
  getCourseCompletionReward,
} from './course-progress';
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
import { withSuppressSignedInNavigation } from './auth-navigation';
import {
  applyActivityCompletionToProfile,
  applyShopPurchaseToProfile,
  buildActivityCompletionResult,
  buildActivitySlotsFromCompletion,
  buildShopPurchaseResult,
} from './game-actions';
import {
  applyLocalTurn,
  buildPendingTurnFeedback,
  buildPendingTurnResult,
  computeLocalTurnOutcome,
  upsertPendingTurn,
} from './turn-registration';
import { executeQueuedMutation, type QueueExecutionResult } from './offline-sync-executor';
import { flushOfflineQueue, type FlushResult } from './offline-sync-flush';
import { useAuthSession } from './hooks/use-auth-session';
import { useOfflineSyncRetryLoop } from './hooks/use-offline-sync-retry-loop';
import { useServerLogMirror } from './hooks/use-server-log-mirror';
import type {
  RoleId,
  Rewards,
  TurnSyncStatus,
  Role,
  GameEvent,
  EventPlanning,
  ShopCatalogItem,
  ActivitySlotsStatus,
  ActivityTelemetryInput,
  CompleteActivityResult,
  CompleteNarrativeChoiceInput,
  CompleteNarrativeChoiceResult,
  ShopPurchaseResult,
  TurnRecord,
  PlayerProfile,
  RegisterTurnInput,
  RegisterTurnResult,
  TurnSyncFeedback,
  GameState,
  TurnStats,
  TheatreReputation,
  LeaderboardEntry,
  Badge,
  CatalogState,
} from './types';
import type { GameContextValue } from './game-context-types';
import { roles, events, activities, DEFAULT_SHOP_CATALOG } from './catalog';
import { MAX_TURNS, MOBILE_WATCHDOG_TIMEOUTS } from './constants';
import {
  sortEventsForPlanning,
  upsertEventPlan,
  removeEventPlan,
  mapPlannedParticipationPlans,
  mapPlannedParticipationEvents,
} from './event-planning';
import {
  OFFLINE_SYNC_SERVER_LOG_QUEUE_KEY,
  logOfflineSync,
} from './offline-sync-log';
import {
  OFFLINE_SYNC_QUEUE_KEY,
  isNavigatorOffline,
  readTurnGeolocationSnapshot,
  summarizeQueuedMutation,
  readQueuedSupabaseMutations,
  enqueueQueuedSupabaseMutation,
  countPendingBoostRequests,
} from './offline-sync-queue';
import type {
  TurnRegisterPayload,
  QueuedSupabaseMutation,
  QueuedSupabaseMutationInput,
} from './offline-sync-queue';
import {
  notifyCriticalError,
  formatSyncError,
  localizeTurnRegistrationError,
  isDuplicateSyncError,
  shouldRetrySyncError,
} from './errors';
import {
  buildProfileUpsertPayload,
  resolveTurnSyncStatusFromRpc,
  parseTurnRegistrationRpcRow,
  parseActivityCompletionRpcRow,
  parseActivitySlotsRpcRow,
  parseShopPurchaseRpcRow,
  parseShopCatalogRows,
  buildTurnRecordFromPayload,
  mapDbRoleRow,
  mapDbEventRow,
  mapDbActivityRow,
  mapDbTurnRow,
  mergeHydratedProfileRow,
  mergeRealtimeProfileRow,
  mapDbTurnStatsRow,
  mapDbTheatreReputationRows,
  mapDbBadgeRow,
  mapDbLeaderboardRow,
} from './supabase-mappers';
import type {
  DbEventRow,
  DbRoleRow,
  DbActivityRow,
  DbTurnRow,
  DbProfileRow,
  DbBadgeRow,
  DbTheatreReputationRow,
  DbLeaderboardRow,
  PlannedParticipationRpcRow,
  TurnRegistrationRpcRow,
} from './supabase-mappers';
import { applyRewards, computeTurnRewards } from './rewards';
import {
  EMPTY_REMOTE_EXPORT_DATA,
  buildUserDataExport,
  buildUserDataExportFileName,
  collectMaxwellChatHistory,
  downloadJson,
  fetchRemoteExportData,
} from './user-data-export';
import {
  computeTurnStatsFromTurns,
  computeTheatreReputationFromTurns,
  computeFallbackBadges,
} from './turn-stats';
import {
  STORAGE_KEY,
  TUTORIAL_ANON_ID,
  readTutorialCompleted,
  writeTutorialCompleted,
  createDefaultState,
  loadState,
  saveState,
} from './persistence';

// Public API re-exported from the domain modules, so importers keep using
// '../state/store' unchanged.
export {
  suppressSignedInNavigation,
  setSuppressSignedInNavigation,
  withSuppressSignedInNavigation,
} from './auth-navigation';
export { ROLE_IDS, EVENT_PLANNING_STATUSES } from './types';
export type {
  RoleId,
  Rewards,
  TurnSyncStatus,
  RoleJourney,
  RoleActivityOverride,
  RoleProfile,
  Role,
  GameEvent,
  EventPlanningStatus,
  EventPlanning,
  Activity,
  ShopCategory,
  ShopCatalogItem,
  ActivitySlotsStatus,
  ActivityTelemetryInput,
  CompleteActivityResult,
  CompleteNarrativeChoiceInput,
  CompleteNarrativeChoiceResult,
  ShopPurchaseResult,
  TurnRecord,
  PlayerProfile,
  RegisterTurnInput,
  RegisterTurnResult,
  TurnSyncFeedback,
  GameState,
  TurnStats,
  TheatreReputation,
  LeaderboardEntry,
  BadgeMetric,
  Badge,
} from './types';
export { roles, events, activities } from './catalog';
export { isRoleId } from './normalizers';
export { parseEventScheduleTimestamp } from './event-planning';
export { selectIsOnboarded } from './selectors';
export { getOfflineSyncRetryDelayMs } from './offline-sync-queue';
export { localizeTurnRegistrationError } from './errors';
export { resolveTurnSyncStatusFromRpc } from './supabase-mappers';
export { getRoleActivityOverride, computeActivityRewards, computeTurnRewards } from './rewards';

const GameStateContext = createContext<GameContextValue | undefined>(undefined);

export function GameStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(() => loadState());
  const [catalog, setCatalog] = useState<CatalogState>(() => ({
    roles,
    events,
    activities,
  }));
  const { authUserId, authReady } = useAuthSession();
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
    // Initialize with a safe default that does not depend on `state` being fully initialized.
    totalSlots: 3,
    remainingSlots: 3,
  });
  const [activitySlotsLoading, setActivitySlotsLoading] = useState(false);
  const [pendingBoostRequests, setPendingBoostRequests] = useState(0);

  useEffect(() => {
    const baseSlots = 3 + state.profile.extraActivitySlots;
    setActivitySlotsStatus((prev) => ({
      usedToday: prev.usedToday,
      totalSlots: baseSlots,
      remainingSlots: Math.max(0, baseSlots - prev.usedToday),
    }));
  }, [state.profile.extraActivitySlots]);
  const [turnSyncFeedback, setTurnSyncFeedback] = useState<TurnSyncFeedback | null>(null);
  const offlineSyncInFlightRef = useRef(false);
  const eventPlansRef = useRef(state.eventPlans);
  // Tracks narrative choice IDs whose rewards have already been applied locally
  // in this session. Guards completeNarrativeChoice against double-credit on
  // re-render, offline-queue replay, or any other duplicate invocation.
  const appliedNarrativeChoicesRef = useRef<Set<string>>(new Set());
  // Ref so refreshActivitySlotsStatus can read the latest extraActivitySlots
  // without being recreated on every shop purchase.
  const extraActivitySlotsRef = useRef(state.profile.extraActivitySlots);
  const catalogEventsRef = useRef(catalog.events);
  const catalogRolesRef = useRef(catalog.roles);
  const profileRoleIdRef = useRef(state.profile.roleId);
  useEffect(() => { eventPlansRef.current = state.eventPlans; }, [state.eventPlans]);
  useEffect(() => { extraActivitySlotsRef.current = state.profile.extraActivitySlots; }, [state.profile.extraActivitySlots]);
  useEffect(() => { catalogEventsRef.current = catalog.events; }, [catalog.events]);
  useEffect(() => { catalogRolesRef.current = catalog.roles; }, [catalog.roles]);
  useEffect(() => { profileRoleIdRef.current = state.profile.roleId; }, [state.profile.roleId]);

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
            setRemoteTurnStats(mapDbTurnStatsRow(data));
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
            setRemoteTheatreReputation(mapDbTheatreReputationRows(data as DbTheatreReputationRow[]));
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
          const { error: rpcError } = await supabase!.rpc('evaluate_my_badges');
          if (rpcError) {
            console.error('[refreshBadges] evaluate_my_badges RPC failed', rpcError.message);
            return;
          }
          const { data, error } = await supabase!
            .from('my_badges')
            .select('id,title,description,icon,metric,threshold,is_hidden,unlocked_at,seen_at,unlocked')
            .order('unlocked_at', { ascending: false, nullsFirst: false })
            .limit(500);
          if (!error && data) {
            setRemoteBadges((data as DbBadgeRow[]).map(mapDbBadgeRow));
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

  const refreshLeaderboard = useCallback(async () => {
    if (!supabase) return;
    await withMobileWatchdog(
      async () => {
        setLeaderboardLoading(true);

        try {
          const { data, error } = await supabase!.rpc('get_leaderboard', { p_limit: 50 });
          if (error) throw error;

          const rows = (data as DbLeaderboardRow[]) ?? [];
          setLeaderboard(rows.map(mapDbLeaderboardRow));
        } catch (error) {
          console.warn('Supabase leaderboard fetch failed', error);
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

  const executeQueuedSupabaseMutation = useCallback(
    (mutation: QueuedSupabaseMutation): Promise<QueueExecutionResult> =>
      executeQueuedMutation(supabase, mutation, applyTurnRegistrationResult),
    [applyTurnRegistrationResult]
  );

  const flushQueuedSupabaseMutations = useCallback(async () => {
    if (offlineSyncInFlightRef.current) {
      logOfflineSync('Flush skipped: already in progress');
      return;
    }
    offlineSyncInFlightRef.current = true;
    let result: FlushResult;
    try {
      result = await flushOfflineQueue({
        authUserId,
        canSync: isSupabaseConfigured && Boolean(supabase),
        execute: executeQueuedSupabaseMutation,
        onQueueChanged: refreshPendingBoostRequests,
      });
    } finally {
      offlineSyncInFlightRef.current = false;
    }
    if (!result.ran) return;

    const { refresh } = result;
    const refreshTasks: Array<Promise<void>> = [];
    if (refresh.turnStats) refreshTasks.push(refreshTurnStats());
    if (refresh.theatreReputation) refreshTasks.push(refreshTheatreReputation());
    if (refresh.badges) refreshTasks.push(refreshBadges());
    if (refreshTasks.length) {
      logOfflineSync('Refreshing derived remote views after flush', refresh);
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
    setHasHydratedRemote(false);
    appliedNarrativeChoicesRef.current = new Set();
  }, [authUserId]);

  useEffect(() => {
    refreshPendingBoostRequests();
  }, [authUserId, refreshPendingBoostRequests]);

  useOfflineSyncRetryLoop(authUserId, flushQueuedSupabaseMutations);

  useServerLogMirror(authUserId, authReady);

  const refreshEventPlanning = useCallback(
    async (catalogEvents: GameEvent[]) => {
      if (!isSupabaseConfigured || !supabase || !authUserId) {
        setEventPlansLoading(false);
        setFollowedEventsLoading(false);
        syncLocalEventPlanning(eventPlansRef.current);
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
              const mappedPlans = mapPlannedParticipationPlans(rows, profileRoleIdRef.current);
              const mappedEvents = mapPlannedParticipationEvents(rows, catalogEvents);

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
    [authUserId, syncLocalEventPlanning]
  );

  // Stable ref so the realtime channel useEffect does not re-subscribe on every
  // role change (which would previously happen because refreshEventPlanning had
  // state.profile.roleId in its useCallback deps, making the function reference
  // change on every role update).
  const refreshEventPlanningRef = useRef(refreshEventPlanning);
  useEffect(() => { refreshEventPlanningRef.current = refreshEventPlanning; }, [refreshEventPlanning]);

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
      const totalSlots = 3 + extraActivitySlotsRef.current;
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
  }, [authUserId]);

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
      const plan = eventPlans.find((p) => p.eventId === eventId);
      const plannedRoleId = plan?.roleId ?? 'attore';
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
          planned_role_id: plannedRoleId,
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
    [authUserId, enqueueSupabaseMutation, eventPlans]
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
    refreshTurnStats().catch(console.error);
    refreshTheatreReputation().catch(console.error);
    refreshBadges().catch(console.error);
    refreshLeaderboard().catch(console.error);
  }, [authUserId, refreshBadges, refreshLeaderboard, refreshTheatreReputation, refreshTurnStats]);

  useEffect(() => {
    if (isSupabaseConfigured && supabase && authUserId) return;
    syncLocalEventPlanning(state.eventPlans);
  }, [authUserId, catalog.events, state.eventPlans, syncLocalEventPlanning]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authUserId) return;
    refreshEventPlanning(catalog.events).catch((err) => {
      console.warn('[store] refreshEventPlanning failed in useEffect:', err);
    });
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
              .select('id,name,theatre,event_date,event_time,genre,base_rewards,focus_role')
              .gte('event_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
            supabase!
              .from('activities')
              .select('id,title,description,duration,xp_reward,cachet_reward,difficulty'),
          ]);

          if (!isMounted) return;

          const nextRoles =
            rolesRes.error || !rolesRes.data?.length
              ? roles
              : (rolesRes.data as DbRoleRow[]).map(mapDbRoleRow);

          const nextEvents =
            eventsRes.error || !eventsRes.data?.length
              ? (isSupabaseConfigured ? [] : import.meta.env.DEV ? events : [])
              : (eventsRes.data as DbEventRow[]).map(mapDbEventRow);

          const nextActivities =
            activitiesRes.error || !activitiesRes.data?.length
              ? import.meta.env.DEV ? activities : []
              : (activitiesRes.data as DbActivityRow[]).map(mapDbActivityRow);

          if (!isMounted) return;
          setCatalog({
            roles: nextRoles,
            events: nextEvents,
            activities: nextActivities,
          });
          // Do NOT call refreshEventPlanning here: the useEffect watching
          // catalog.events (below) will call it once the state update is
          // committed, avoiding a duplicate get_my_planned_participations RPC
          // that was fired on every catalog load (closes #1215).
        },
        {
          operation: 'loadCatalog',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.loadCatalog,
          title: 'Catalogo mobile lento',
          message: 'Il caricamento del catalogo mobile sta impiegando troppo tempo.',
        }
      );
    };

    loadCatalog().catch((err: unknown) => console.warn('[store] loader rejected', err));

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
            supabase!.from('turns').select('*').eq('user_id', authUserId).order('created_at', { ascending: false }).limit(500),
          ]);

          if (!isMounted) return;

          if (userRes.error || profileRes.error) {
            notifyCriticalError('Non riusciamo a caricare il profilo dal database.', [
              userRes.error,
              profileRes.error,
            ]);
            setHasHydratedRemote(true);
            return;
          }

          if (turnsRes.error) {
            notifyCriticalError('Non riusciamo a caricare i turni dal database.', [turnsRes.error]);
            setHasHydratedRemote(true);
            return;
          }

          // Note: profileRes.error is guaranteed falsy here — the combined check
          // at line ~3769 already returned early on any userRes/profileRes error.
          // The dead guard that previously appeared here has been removed to keep
          // the control-flow explicit and avoid confusion during future refactors.

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
              // Fix #1127 (Bug 1): must return here — without this the execution
              // continues with profileRow=null, if(profileRow) is false, and
              // setHasHydratedRemote(true) is still reached, unblocking the app
              // with stale/default local state instead of valid remote data.
              return;
            }
            profileRow = insertRes.data ?? null;
          } else if (!profileRow) {
            // No profile row exists and the authenticated user has no email address
            // (e.g. anonymous auth, OAuth provider that did not supply an email).
            // Silently unblocking the app with a blank profile would leave it in an
            // invalid state, so surface a critical error instead. Closes #1123.
            notifyCriticalError('Non riusciamo a creare il profilo utente: email mancante.', []);
            // Fix #1127 (Bug 2): set hasHydratedRemote=true before returning so
            // the guard doesn't stay false permanently after the error is dismissed,
            // which would block sync operations and certain effects indefinitely.
            // Guard added for #1557: isMounted check must precede the call so the
            // setter is not invoked on an unmounted instance (provider race window).
            if (isMounted) setHasHydratedRemote(true);
            return;
          }

          if (!isMounted) return;

          const remoteTurns = Array.isArray(turnsRes.data)
            ? (turnsRes.data as DbTurnRow[]).map(mapDbTurnRow)
            : [];

          if (profileRow) {
            const user = userRes.data?.user;
            setState((prev: GameState) => ({
              profile: mergeHydratedProfileRow(prev.profile, profileRow, user),
              eventPlans: prev.eventPlans,
              turns: remoteTurns.slice(0, MAX_TURNS),
            }));
          }

          setHasHydratedRemote(true);
        },
        {
          operation: 'loadRemoteState',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.loadRemoteState,
          title: 'Stato remoto lento',
          message: 'Il caricamento dello stato remoto mobile sta impiegando troppo tempo.',
        }
      );
    };

    loadRemoteState()
      .catch((err: unknown) => console.warn('[store] loader rejected', err))
      .finally(() => {
        if (isMounted) setHasHydratedRemote(true);
      });

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
            profile: mergeRealtimeProfileRow(prev.profile, profile),
          }));
          setHasHydratedRemote(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turns', filter: `user_id=eq.${authUserId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const nextTurn = mapDbTurnRow(payload.new as DbTurnRow);
            setState((prev: GameState) => {
              if (prev.turns.some((turn: TurnRecord) => turn.id === nextTurn.id)) {
                return prev;
              }
              const merged = [nextTurn, ...prev.turns].sort((a: TurnRecord, b: TurnRecord) => b.createdAt - a.createdAt);
              return { ...prev, turns: merged.slice(0, MAX_TURNS) };
            });
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const nextTurn = mapDbTurnRow(payload.new as DbTurnRow);
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

          refreshTurnStats().catch(console.error);
          refreshTheatreReputation().catch(console.error);
          refreshBadges().catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshBadges().catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planned_participations', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshEventPlanningRef.current(catalogEventsRef.current).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_completions', filter: `user_id=eq.${authUserId}` },
        () => {
          refreshActivitySlotsStatus().catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_catalog' },
        () => {
          refreshShopCatalog().catch(console.error);
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
    refreshBadges,
    refreshActivitySlotsStatus,
    refreshFeatureFlags,
    refreshShopCatalog,
    refreshTheatreReputation,
    refreshTurnStats,
  ]);

  const persistProfile = useCallback(
    (profile: PlayerProfile) => {
      if (!supabase || !authUserId) {
        logOfflineSync('persistProfile skipped: missing supabase client or auth user', {
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
      if (!hasHydratedRemote) {
        // Remote state is still being loaded (e.g. slow connection during FTUE).
        // Queue the mutation so it is flushed once hydration completes instead
        // of silently discarding the profile update.
        logOfflineSync('persistProfile queued: hydration not yet complete', {
          authUserId,
          roleId: profile.roleId,
          level: profile.level,
        }, 'warn');
        enqueueSupabaseMutation(queuedMutation);
        return;
      }
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

  useEffect(() => {
    if (authUserId) {
      // On login: migrate any anonymous tutorial completion to the real user key
      // so progress from demo/guest mode survives authentication (closes #1316).
      const anonCompleted = readTutorialCompleted(TUTORIAL_ANON_ID);
      if (anonCompleted) {
        writeTutorialCompleted(authUserId, true);
        writeTutorialCompleted(TUTORIAL_ANON_ID, false);
      }
      const completed = readTutorialCompleted(authUserId) || anonCompleted;
      setState((prev: GameState) =>
        prev.profile.tutorialCompleted === completed
          ? prev
          : { ...prev, profile: { ...prev.profile, tutorialCompleted: completed } }
      );
    } else {
      // Not authenticated: read from the anonymous key so demo/guest users
      // don't restart the tutorial on every page reload (closes #1316).
      const completed = readTutorialCompleted(TUTORIAL_ANON_ID);
      setState((prev: GameState) =>
        prev.profile.tutorialCompleted === completed
          ? prev
          : { ...prev, profile: { ...prev.profile, tutorialCompleted: completed } }
      );
    }
  }, [authUserId]);

  const completeTutorial = useCallback(() => {
    // Write to the real user key when authenticated, otherwise use the stable
    // anonymous key so completion survives page reloads in demo/guest mode
    // (closes #1316).
    writeTutorialCompleted(authUserId ?? TUTORIAL_ANON_ID, true);
    setState((prev: GameState) => ({
      ...prev,
      profile: { ...prev.profile, tutorialCompleted: true },
    }));
  }, [authUserId]);

  const resetTutorial = useCallback(() => {
    writeTutorialCompleted(authUserId ?? TUTORIAL_ANON_ID, false);
    setState((prev: GameState) => ({
      ...prev,
      profile: { ...prev.profile, tutorialCompleted: false },
    }));
  }, [authUserId]);

  const completeOnboarding = useCallback(
    (variant: 'full' | 'skipped_qr' | 'skipped_manual', xpReward?: number) => {
      const completedAt = new Date().toISOString();
      // Compute next profile from the render-time snapshot so persistProfile can
      // be called synchronously. The ref-inside-updater pattern was broken: React
      // 18 (createRoot) defers useState updaters to the commit phase, so
      // nextProfileRef.current was always null when checked after setState()
      // (closes #1535, regression of #1312).
      let next: PlayerProfile = {
        ...state.profile,
        onboardingCompletedAt: completedAt,
        onboardingVariant: variant,
      };
      if (xpReward && xpReward > 0) {
        next = applyRewards(next, { xp: xpReward, cachet: 0, reputation: 0 }, 'activity');
      }
      persistProfile(next);
      // The updater re-derives from prev.profile so that any concurrent profile
      // mutation between this render and the next commit is not clobbered
      // (same trade-off as startCourse, closes #1378).
      setState((prev: GameState) => {
        let nextFromPrev: PlayerProfile = {
          ...prev.profile,
          onboardingCompletedAt: completedAt,
          onboardingVariant: variant,
        };
        if (xpReward && xpReward > 0) {
          nextFromPrev = applyRewards(nextFromPrev, { xp: xpReward, cachet: 0, reputation: 0 }, 'activity');
        }
        return { ...prev, profile: nextFromPrev };
      });
    },
    [persistProfile, state.profile],
  );

  const updateProfile = useCallback(
    (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId' | 'profileImage' | 'leaderboardVisible'>>) => {
      // Compute from render-time snapshot for persistProfile (closes #1535).
      const nextRole =
        updates.roleId && catalogRolesRef.current.some((role: Role) => role.id === updates.roleId)
          ? updates.roleId
          : state.profile.roleId;
      const next: PlayerProfile = { ...state.profile, ...updates, roleId: nextRole ?? state.profile.roleId };
      persistProfile(next);
      // Updater re-derives from prev.profile to preserve concurrent mutations.
      setState((prev: GameState) => {
        const prevRole =
          updates.roleId && catalogRolesRef.current.some((role: Role) => role.id === updates.roleId)
            ? updates.roleId
            : prev.profile.roleId;
        return { ...prev, profile: { ...prev.profile, ...updates, roleId: prevRole ?? prev.profile.roleId } };
      });
    },
    [persistProfile, state.profile],
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

      if (!featureFlags['registra_turno']) {
        logOfflineSync('registerTurn aborted: feature disabled', { eventId, roleId, feature: 'registra_turno' }, 'warn');
        return { ok: false, error: 'Registrazione turni temporaneamente disattivata.' };
      }

      if (boostRequested && !featureFlags['boost_turno']) {
        logOfflineSync('registerTurn aborted: boost feature disabled', { eventId, roleId, feature: 'boost_turno' }, 'warn');
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

      const geofenceValidationEnabled = featureFlags['geofence'];
      // GDPR Art. 7 – raccogliamo la posizione solo se l'utente ha fornito consenso esplicito.
      const geoConsent = typeof window !== 'undefined'
        ? window.localStorage.getItem(GEO_CONSENT_KEY)
        : null;
      const requiresServerGeolocation = geofenceValidationEnabled
        && isSupabaseConfigured
        && Boolean(supabase)
        && Boolean(authUserId)
        && geoConsent === 'granted';
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
        // Compute boost/rewards BEFORE calling setState so the results are
        // available immediately. The ref-inside-updater pattern used previously
        // was broken: React 18 (createRoot) defers useState updaters to the
        // commit phase, so localResultRef.current was always null when read
        // after setState(), causing a TypeError crash via the ! assertion
        // (closes #1533, regression of #1523 fix).
        //
        // state.profile is safe to read here: in demo/local mode there is no
        // server sync, so tokenAtcl cannot change concurrently. state.profile
        // is added to the useCallback deps so the closure is always fresh.
        const localOutcome = computeLocalTurnOutcome(event, roleId, boostRequested, state.profile.tokenAtcl);
        const { rewards, boostApplied, boostRejectionReason, nextTokenAtcl, syncStatus: localSyncStatus } = localOutcome;
        const localTurnRecord: TurnRecord = buildTurnRecordFromPayload(
          turnRegisterPayload,
          rewards,
          localSyncStatus,
          boostApplied,
          boostRejectionReason
        );

        setState((prev: GameState) => applyLocalTurn(prev, localOutcome, localTurnRecord));

        setTurnSyncFeedback({
          syncStatus: localSyncStatus,
          boostRequested,
          boostApplied,
          boostRejectionReason,
          eventName: event.name,
          createdAt: Date.now(),
          geolocationAvailable: Boolean(geolocationSnapshot),
        });
        return {
          ok: true,
          syncStatus: localSyncStatus,
          boostRequested,
          boostApplied,
          boostRejectionReason,
          rewards,
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
        // Mirror the online-RPC-failure path: add the pending turn to local
        // state immediately so it appears in history while the device is
        // offline, before the queue flushes (closes #1528).
        setState((prev: GameState) => ({ ...prev, turns: upsertPendingTurn(prev.turns, pendingTurnRecord) }));
        setTurnSyncFeedback(
          buildPendingTurnFeedback(event.name, boostRequested, Boolean(geolocationSnapshot), Date.now())
        );
        return buildPendingTurnResult(pendingTurnRecord, boostRequested);
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
        // Add the pending turn record to local state immediately so the UI
        // shows the turn while waiting for the offline sync flush to complete.
        // applyTurnRegistrationResult handles duplicates by ID (merge), so
        // adding the record here is safe and idempotent.
        setState((prev: GameState) => ({ ...prev, turns: upsertPendingTurn(prev.turns, pendingTurnRecord) }));
        setTurnSyncFeedback(
          buildPendingTurnFeedback(event.name, boostRequested, Boolean(geolocationSnapshot), Date.now())
        );
        return buildPendingTurnResult(pendingTurnRecord, boostRequested);
      }
    },
    [
      authUserId,
      catalog.events,
      enqueueSupabaseMutation,
      featureFlags,
      applyTurnRegistrationResult,
      state.profile,
    ]
  );

  const purchaseShopItem = useCallback(
    async (itemCode: string, targetTheatre?: string | null): Promise<ShopPurchaseResult> => {
      if (!featureFlags['acquisti']) {
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

        const result = buildShopPurchaseResult(rpcResponse);
        if (!result.ok) return result;

        setState((prev: GameState) => {
          const nextProfile = applyShopPurchaseToProfile(prev.profile, rpcResponse);
          return nextProfile === prev.profile ? prev : { ...prev, profile: nextProfile };
        });

        refreshActivitySlotsStatus().catch(() => {});
        if (rpcResponse.theatre) {
          refreshTheatreReputation().catch(() => {});
        }

        return result;
      } catch (error) {
        const errorMessage = formatSyncError(error);
        return {
          ok: false,
          status: 'error',
          error: errorMessage || "Errore durante l'acquisto shop.",
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
      if (!featureFlags['completa_attivita']) {
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

        const slots = buildActivitySlotsFromCompletion(rpcResponse);
        setActivitySlotsStatus(slots.status);

        const result = buildActivityCompletionResult(rpcResponse, activity, slots);
        if (!result.ok) return result;

        setState((prev: GameState) => {
          const nextProfile = applyActivityCompletionToProfile(prev.profile, rpcResponse);
          return nextProfile === prev.profile ? prev : { ...prev, profile: nextProfile };
        });

        refreshBadges().catch(() => {});

        return result;
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

  // Issue #328 — narrative scene choice completion.
  // The scene + choice are validated and resolved by the UI layer (see
  // NarrativeScene.tsx) using the engine in `gameplay/narrative.ts`. This
  // function is the persistence/state-mutation half: it applies rewards
  // locally and best-effort logs the choice into `narrative_history`.
  const completeNarrativeChoice = useCallback(
    async (input: CompleteNarrativeChoiceInput): Promise<CompleteNarrativeChoiceResult> => {
      // Idempotency guard: prevent double-credit if this function is called
      // more than once for the same scene+choice (re-render, offline-queue
      // replay, race condition, or app restart mid-scene).
      const choiceKey = JSON.stringify([input.sceneId, input.choiceId]);
      if (appliedNarrativeChoicesRef.current.has(choiceKey)) {
        logOfflineSync('completeNarrativeChoice skipped — already applied', { choiceKey }, 'warn');
        return { ok: true, rewards: { xp: 0, cachet: 0, reputation: 0 } };
      }
      appliedNarrativeChoicesRef.current.add(choiceKey);

      const rewards: Rewards = {
        xp: Math.max(0, Math.round(input.rewards.xp ?? 0)),
        cachet: Math.max(0, Math.round(input.rewards.cachet ?? 0)),
        reputation: Math.max(0, Math.round(input.rewards.reputation ?? 0)),
      };

      // 1. Apply rewards locally — visible immediately in Home/profile.
      // Compute nextProfile inside the setState updater using prev.profile so
      // concurrent profile updates (e.g. from a parallel turn registration) are
      // not silently discarded (closes #1353).
      //
      // React 18 may defer the setState updater when called from an async
      // context, so reading `nextProfile` immediately after setState() is not
      // safe — the updater may not have run yet (closes #1377). We use a ref
      // to capture the computed value inside the updater and read it
      // synchronously afterward, which is safe because the ref write happens
      // inside the updater body (before the next line after setState executes
      // in any React scheduler tick that matters for us).
      // 1b. Persist updated profile to server so XP/cachet/reputation survive
      // a page reload. Compute from render-time snapshot first so persistProfile
      // is called synchronously — React 18 defers the setState updater, making
      // nextProfileRef.current still null when read immediately after setState()
      // (closes #1200, #1377, #1547; same pattern as completeOnboarding / #1535).
      persistProfile(applyRewards(state.profile, rewards, 'activity'));
      setState((prev: GameState) => ({ ...prev, profile: applyRewards(prev.profile, rewards, 'activity') }));

      // 2. Persist to narrative_history (append-only, RLS-scoped to user).
      // Best-effort: a failed insert does not roll back local rewards. Without
      // a server-side reward authority for narrative scenes, retrying client
      // rewards on offline replay would risk double-credit. Tracked separately.
      if (isSupabaseConfigured && supabase && authUserId) {
        try {
          const { error } = await supabase.from('narrative_history').insert({
            user_id: authUserId,
            scene_id: input.sceneId,
            choice_id: input.choiceId,
            rewards,
            flags_set: input.setFlags ?? [],
          });
          if (error) {
            logOfflineSync('narrative_history insert failed', { error: formatSyncError(error) }, 'warn');
          }
        } catch (error) {
          logOfflineSync('narrative_history insert threw', { error: formatSyncError(error) }, 'warn');
        }
      }

      return { ok: true, rewards };
    },
    [authUserId, persistProfile, state.profile]
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

        if (authUserId) writeTutorialCompleted(authUserId, false);
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
            skills: { precision: 0, presence: 0, creativity: 0, leadership: 0 },
            activeCourses: {},
            completedCourses: {},
            onboardingCompletedAt: null,
            onboardingVariant: null,
            tutorialCompleted: false,
          },
          turns: [],
          eventPlans: [],
        }));

        setRemoteTurnStats(null);
        setRemoteTheatreReputation([]);
        setRemoteBadges([]);
        setActivitySlotsStatus({
          usedToday: 0,
          totalSlots: 3,
          remainingSlots: 3,
        });
        setEventPlans([]);
        setEventPlansLoading(false);
        setFollowedEvents([]);
        setFollowedEventsLoading(false);
        setLeaderboard([]);
        setLeaderboardLoading(false);

        // Clear the narrative idempotency guard so that narrative rewards can
        // be replayed after a progress reset in the same session (closes #1199).
        appliedNarrativeChoicesRef.current = new Set();

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
            // Use getUser() (network-verified) instead of getSession() (locally
            // cached) so that an empty/stale local session cache does not cause
            // a false "Email mancante" error when the user IS authenticated
            // (closes #1135).
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            const email = userData.user?.email;
            if (!email) {
              throw new Error('Email mancante');
            }
            // Suppress the SIGNED_IN auth-state event that signInWithPassword
            // emits: it would otherwise trigger navigation to 'home' via
            // useAuth's onAuthStateChange listener before the password update
            // even runs.
            const client = supabase;
            const { error: signInError } = await withSuppressSignedInNavigation(() =>
              client.auth.signInWithPassword({
                email,
                password: currentPassword,
              })
            );
            if (signInError) throw new Error('Password attuale non valida');
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
        message: "L'invio email per il reset password sta impiegando troppo tempo.",
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

  // Issue #327 — Avvia un corso formativo.
  const startCourse = useCallback(
    (courseId: string): { ok: true } | { ok: false; error: string } => {
      // Perform guard checks synchronously against the current state snapshot
      // BEFORE calling setState, so that the updater only contains the happy-path
      // state transition. This avoids mutating external variables inside the
      // setState updater — which React StrictMode double-invokes and could produce
      // incorrect results under future React versions (closes #1361).
      const check = checkCourseStart(state.profile, courseId, Date.now());
      if (!check.ok) return check;

      // Compute nextProfile inside the setState updater using prev.profile so
      // concurrent profile mutations (e.g. a Realtime subscription firing during
      // course start) are not silently clobbered (closes #1378). Guard checks
      // above use the render-time snapshot for early returns, which is acceptable
      // since they gate on game-logic invariants rather than numeric values that
      // could race. The state transition itself uses prev.profile.
      const startedAt = new Date().toISOString();
      // Persist synchronously from render-time snapshot; re-derive from prev
      // inside setState so concurrent mutations are not clobbered (closes #1547).
      persistProfile(applyCourseStart(state.profile, check.course, startedAt));
      setState((prev) => ({ ...prev, profile: applyCourseStart(prev.profile, check.course, startedAt) }));

      return { ok: true };
    },
    [persistProfile, state.profile],
  );

  // Issue #327 — Completa un corso attivo.
  const completeCourse = useCallback(
    (
      courseId: string,
    ):
      | { ok: true; xpGained: number; skillGained: CourseSkill; pointsGained: number }
      | { ok: false; error: string } => {
      // Perform guard checks synchronously against the current state snapshot
      // BEFORE calling setState — same rationale as startCourse (closes #1361).
      const check = checkCourseCompletion(state.profile, courseId, Date.now(), import.meta.env.DEV);
      if (!check.ok) return check;

      // Compute nextProfile inside the setState updater using prev.profile so
      // concurrent profile mutations are not silently clobbered (closes #1378).
      const completedAt = new Date().toISOString();
      // Persist synchronously from render-time snapshot; re-derive from prev
      // inside setState so concurrent mutations are not clobbered (closes #1547).
      persistProfile(applyCourseCompletion(state.profile, check.course, completedAt));
      setState((prev) => ({ ...prev, profile: applyCourseCompletion(prev.profile, check.course, completedAt) }));

      return { ok: true, ...getCourseCompletionReward(check.course) };
    },
    [persistProfile, state.profile],
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
    // Reset remote-state arrays and loading flags so stale data from a previous
    // session is not visible after logout (closes #1185).
    setRemoteTurnStats(null);
    setStatsLoading(false);
    setRemoteTheatreReputation([]);
    setTheatreReputationLoading(false);
    setLeaderboard([]);
    setLeaderboardLoading(false);
    setRemoteBadges([]);
    setBadgesLoading(false);
    setShopCatalog(DEFAULT_SHOP_CATALOG);
    setShopCatalogLoading(false);
    setActivitySlotsLoading(false);
    const totalSlots = 3 + next.profile.extraActivitySlots;
    setActivitySlotsStatus({
      usedToday: 0,
      totalSlots,
      remainingSlots: totalSlots,
    });
    // Clear the narrative idempotency guard so that replaying scenes after a
    // progress reset in the same session yields rewards correctly (closes #1130).
    appliedNarrativeChoicesRef.current = new Set();
    // Clear in-memory ticket activation caches so that a new user logging in on
    // the same browser tab does not inherit the previous user's activated-ticket
    // records (closes #1313).
    clearLocalActivationStores();
    // Reset hydration flag so persistProfile's guard re-arms and does not sync
    // blank default state to the DB if called before the next remote hydration
    // completes (closes #1132).
    setHasHydratedRemote(false);
    // Clear the offline server-log queue so that a new user logging in on the
    // same device does not have the previous user's queued logs flushed under
    // their identity (closes #1524).
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(OFFLINE_SYNC_SERVER_LOG_QUEUE_KEY); } catch { /* ignore */ }
    }
  }, []);

  // GDPR Art. 17 – Diritto alla cancellazione: elimina account e tutti i dati utente.
  const deleteAccount = useCallback(async (options?: { onBeforeSignOut?: () => void; onSignOutFailed?: () => void }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase non configurato');
    }
    if (!authUserId) {
      throw new Error('Devi essere autenticato per eliminare il profilo');
    }
    const { error } = await supabase.functions.invoke('delete-my-account');
    if (error) {
      throw new Error(error.message || 'Impossibile eliminare il profilo. Riprova.');
    }
    // Clear all local storage keys owned by this app
    if (typeof window !== 'undefined') {
      [
        SUPABASE_SESSION_KEY,
        LEGACY_SUPABASE_SESSION_KEY,
        SUPABASE_SESSION_ID_KEY,
        LEGACY_SUPABASE_SESSION_ID_KEY,
        STORAGE_KEY,
        OFFLINE_SYNC_QUEUE_KEY,
        GEO_CONSENT_KEY,
        // Explicit: prevents a subsequent user on the same device from inheriting
        // this account's cookie consent decision (GDPR — closes #1414).
        COOKIE_CONSENT_KEY,
      ].forEach((k) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } });
      // Also clear any remaining tdp-* and sb-*-auth-token keys
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('tdp-') || (key.startsWith('sb-') && key.endsWith('-auth-token')))) {
          try { window.localStorage.removeItem(key); } catch { /* ignore */ }
        }
      }
    }
    // Invoke the caller's pre-signOut hook (e.g. markVoluntaryLogout from useAuth)
    // immediately before signOut() so isVoluntaryLogoutRef is set synchronously
    // right before the SIGNED_OUT event fires — eliminates any timing gap and
    // ensures the flag is always set regardless of the call site (issue #1124).
    options?.onBeforeSignOut?.();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // signOut failed: no SIGNED_OUT event will fire, so isVoluntaryLogoutRef
      // would stay permanently true without this reset. Call onSignOutFailed
      // (e.g. unmarkVoluntaryLogout) so the caller can restore the ref to false,
      // ensuring the next involuntary session expiry still shows the banner.
      options?.onSignOutFailed?.();
      throw e;
    }
    resetState();
  }, [authUserId, resetState]);

  // GDPR Art. 15/20 – Diritto di accesso e portabilità: scarica tutti i dati in formato JSON.
  const exportUserData = useCallback(async () => {
    const chatHistory = collectMaxwellChatHistory(typeof window !== 'undefined' ? localStorage : undefined);

    // Fall back to state.turns only when Supabase is unavailable (e.g. offline).
    const remote = isSupabaseConfigured && supabase && authUserId
      ? await fetchRemoteExportData(supabase, authUserId)
      : EMPTY_REMOTE_EXPORT_DATA;

    const data = buildUserDataExport({
      profile: state.profile,
      turns: remote.turns ?? state.turns,
      remote,
      badges,
      theatreReputation,
      plannedEvents: eventPlans,
      chatHistory,
      exportDate: new Date(),
    });
    downloadJson(data, buildUserDataExportFileName(state.profile.name, Date.now()));
  }, [state.profile, state.turns, authUserId, badges, theatreReputation, eventPlans]);

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
      completeTutorial,
      resetTutorial,
      completeOnboarding,
      registerTurn,
      pendingBoostRequests,
      turnSyncFeedback,
      clearTurnSyncFeedback,
      completeActivity,
      completeNarrativeChoice,
      resetProgress,
      deleteAccount,
      exportUserData,
      changePassword,
      sendPasswordResetEmail,
      startCourse,
      completeCourse,
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
      completeTutorial,
      resetTutorial,
      completeOnboarding,
      registerTurn,
      pendingBoostRequests,
      turnSyncFeedback,
      clearTurnSyncFeedback,
      completeActivity,
      completeNarrativeChoice,
      resetProgress,
      deleteAccount,
      exportUserData,
      changePassword,
      sendPasswordResetEmail,
      startCourse,
      completeCourse,
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
