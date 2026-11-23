import { COOKIE_CONSENT_KEY } from '../constants/privacy';
import type {
  Activity,
  Badge,
  BadgeMetric,
  GameEvent,
  LeaderboardEntry,
  PlayerProfile,
  Rewards,
  Role,
  RoleId,
  ShopCatalogItem,
  TheatreReputation,
  TurnRecord,
  TurnStats,
  TurnSyncStatus,
} from './types';
import { DEFAULT_SHOP_CATALOG } from './catalog';
import { isRecord, isRoleId, normalizeRoleProfile, normalizeText } from './normalizers';
import { resolveDisplayName } from '../lib/profile-utils';
import { sanitizeProfileImageUrl } from '../lib/profile-image-url';
import type { ProfileUpsertPayload, TurnRegisterPayload } from './offline-sync-queue';

// DB row types — shape returned by Supabase queries
export type DbEventRow = {
  id: string;
  name: string;
  theatre: string;
  event_date: string;
  event_time: string | null;
  genre: string;
  base_rewards?: { xp?: number; reputation?: number; cachet?: number } | null;
  focus_role?: string | null;
};

export type DbRoleRow = {
  id: string;
  name: string;
  focus: string;
  stats?: { presence?: number; precision?: number; leadership?: number; creativity?: number } | null;
  role_profile?: unknown;
};

export type DbActivityRow = {
  id: string;
  title: string;
  description: string;
  duration: string;
  xp_reward: number;
  cachet_reward: number;
  difficulty: string;
};

export type DbTurnRow = {
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

export type DbProfileRow = {
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
  leaderboard_visible?: boolean | null;
  onboarding_completed_at?: string | null;
  onboarding_variant?: string | null;
  // Course state — Issue #327 / migration 20260525000000.
  skills?: { precision: number; presence: number; creativity: number; leadership: number } | null;
  active_courses?: Record<string, string> | null;
  completed_courses?: Record<string, string> | null;
};

export type DbBadgeRow = {
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

export type DbTheatreReputationRow = {
  theatre?: string | null;
  reputation?: number | null;
  total_turns?: number | null;
};

export type PlannedParticipationRpcRow = {
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

export function buildProfileUpsertPayload(userId: string, profile: PlayerProfile): ProfileUpsertPayload {
  const raw = typeof window !== 'undefined'
    ? window.localStorage.getItem(COOKIE_CONSENT_KEY)
    : null;
  // Backward-compat: '1' (vecchio formato pre-timestamp) → usa "now" come best-effort
  const cookieConsentAt = raw === '1' ? new Date().toISOString() : raw ?? undefined;

  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    role_id: profile.roleId,
    profile_image: sanitizeProfileImageUrl(profile.profileImage, userId) ?? null,
    leaderboard_visible: profile.leaderboardVisible,
    ...(cookieConsentAt ? { cookie_consent_at: cookieConsentAt } : {}),
    onboarding_completed_at: profile.onboardingCompletedAt ?? null,
    onboarding_variant: profile.onboardingVariant ?? null,
    // Course state — Issue #327 / migration 20260525000000.
    skills: profile.skills ?? {},
    active_courses: profile.activeCourses ?? {},
    completed_courses: profile.completedCourses ?? {},
  };
}

export type TurnRegistrationRpcRow = {
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

export function parseTurnRegistrationRpcRow(data: unknown): TurnRegistrationRpcRow | null {
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

export function parseActivityCompletionRpcRow(data: unknown): ActivityCompletionRpcRow | null {
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

export function parseActivitySlotsRpcRow(data: unknown): ActivitySlotsRpcRow | null {
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

export function parseShopPurchaseRpcRow(data: unknown): ShopPurchaseRpcRow | null {
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

export function parseShopCatalogRows(data: unknown): ShopCatalogItem[] {
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

export function buildTurnRecordFromPayload(
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

// ─── DB row → domain mappers ─────────────────────────────────────────────────

export function mapDbRoleRow(role: DbRoleRow): Role {
  return {
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
  };
}

export function mapDbEventRow(event: DbEventRow): GameEvent {
  return {
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
  };
}

export function mapDbActivityRow(activity: DbActivityRow): Activity {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    duration: activity.duration,
    xpReward: activity.xp_reward,
    cachetReward: activity.cachet_reward,
    difficulty: activity.difficulty as Activity['difficulty'],
  };
}

export function mapDbTurnRow(turn: DbTurnRow): TurnRecord {
  return {
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
  };
}

function resolveOnboardingVariant(
  value: string | null | undefined,
  fallback: PlayerProfile['onboardingVariant'],
): PlayerProfile['onboardingVariant'] {
  return value === 'full' || value === 'skipped_qr' || value === 'skipped_manual' ? value : fallback;
}

type AuthUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

/**
 * Merges the profile row loaded at startup (loadRemoteState) into the local
 * profile. Remote values win when present; local values are kept otherwise so
 * offline mutations are not lost.
 */
export function mergeHydratedProfileRow(
  prev: PlayerProfile,
  profileRow: DbProfileRow,
  user: AuthUserLike,
): PlayerProfile {
  const parsedLastActivityAt = profileRow.last_activity_at ? new Date(profileRow.last_activity_at).getTime() : NaN;
  return {
    ...prev,
    name: resolveDisplayName({
      name: profileRow.name,
      metadata: user?.user_metadata,
      email: profileRow.email ?? user?.email ?? prev.email,
      fallback: prev.name,
    }),
    email: profileRow.email ?? prev.email,
    roleId: isRoleId(profileRow.role_id) ? profileRow.role_id : prev.roleId,
    level: profileRow.level ?? prev.level,
    xp: profileRow.xp ?? prev.xp,
    xpToNextLevel: profileRow.xp_to_next_level ?? prev.xpToNextLevel,
    xpTotal: profileRow.xp_total ?? prev.xpTotal,
    xpField: profileRow.xp_field ?? prev.xpField,
    reputation: profileRow.reputation ?? prev.reputation,
    cachet: profileRow.cachet ?? prev.cachet,
    tokenAtcl: profileRow.token_atcl ?? prev.tokenAtcl,
    extraActivitySlots: profileRow.extra_activity_slots ?? prev.extraActivitySlots,
    profileImage: profileRow.profile_image ?? prev.profileImage,
    lastActivityAt: Number.isFinite(parsedLastActivityAt) ? parsedLastActivityAt : prev.lastActivityAt,
    leaderboardVisible: profileRow.leaderboard_visible ?? prev.leaderboardVisible,
    onboardingCompletedAt: profileRow.onboarding_completed_at ?? prev.onboardingCompletedAt,
    onboardingVariant: resolveOnboardingVariant(profileRow.onboarding_variant, prev.onboardingVariant),
    // Course state — Issue #327. Prefer remote values when present; fall
    // back to local (localStorage) so offline mutations are not lost.
    skills: profileRow.skills ?? prev.skills,
    activeCourses: profileRow.active_courses ?? prev.activeCourses,
    completedCourses: profileRow.completed_courses ?? prev.completedCourses,
  };
}

/**
 * Merges a profile row received from the Supabase Realtime channel into the
 * local profile. Unlike the startup merge it has no auth user metadata.
 */
export function mergeRealtimeProfileRow(prev: PlayerProfile, profile: DbProfileRow): PlayerProfile {
  return {
    ...prev,
    name: resolveDisplayName({
      name: profile.name,
      email: profile.email ?? prev.email,
      fallback: prev.name,
    }),
    email: profile.email ?? prev.email,
    roleId: isRoleId(profile.role_id) ? profile.role_id : prev.roleId,
    level: profile.level ?? prev.level,
    xp: profile.xp ?? prev.xp,
    xpToNextLevel: profile.xp_to_next_level ?? prev.xpToNextLevel,
    xpTotal: profile.xp_total ?? prev.xpTotal,
    xpField: profile.xp_field ?? prev.xpField,
    reputation: profile.reputation ?? prev.reputation,
    cachet: profile.cachet ?? prev.cachet,
    tokenAtcl: profile.token_atcl ?? prev.tokenAtcl,
    extraActivitySlots: profile.extra_activity_slots ?? prev.extraActivitySlots,
    profileImage: profile.profile_image ?? prev.profileImage,
    lastActivityAt: profile.last_activity_at ? new Date(profile.last_activity_at).getTime() : prev.lastActivityAt,
    leaderboardVisible: profile.leaderboard_visible != null ? profile.leaderboard_visible : prev.leaderboardVisible,
    onboardingCompletedAt: profile.onboarding_completed_at ?? prev.onboardingCompletedAt,
    onboardingVariant: resolveOnboardingVariant(profile.onboarding_variant, prev.onboardingVariant),
    skills: profile.skills ?? prev.skills,
    activeCourses: profile.active_courses ?? prev.activeCourses,
    completedCourses: profile.completed_courses ?? prev.completedCourses,
  };
}

// ─── Remote stats, reputation, badges and leaderboard ────────────────────────

export type DbTurnStatsRow = {
  total_turns?: number | null;
  turns_this_month?: number | null;
  unique_theatres?: number | null;
};

export function mapDbTurnStatsRow(row: DbTurnStatsRow): TurnStats {
  return {
    totalTurns: Number(row.total_turns ?? 0),
    turnsThisMonth: Number(row.turns_this_month ?? 0),
    uniqueTheatres: Number(row.unique_theatres ?? 0),
  };
}

/** Mappa le righe di my_theatre_reputation, scarta i teatri vuoti e ordina per reputazione. */
export function mapDbTheatreReputationRows(rows: DbTheatreReputationRow[]): TheatreReputation[] {
  return rows
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
}

export function mapDbBadgeRow(row: DbBadgeRow): Badge {
  return {
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
  };
}

export type DbLeaderboardRow = {
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

export function mapDbLeaderboardRow(row: DbLeaderboardRow): LeaderboardEntry {
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
}
