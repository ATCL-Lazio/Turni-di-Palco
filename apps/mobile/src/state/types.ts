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
    isDuplicate?: boolean;
  }
  | {
    ok: false;
    error: string;
    rejectionReason?: string | null;
    slotsUsedToday?: number;
    slotsTotal?: number;
  };

export type CompleteNarrativeChoiceInput = {
  sceneId: string;
  choiceId: string;
  rewards: Partial<Rewards>;
  setFlags?: string[];
};

export type CompleteNarrativeChoiceResult =
  | { ok: true; rewards: Rewards }
  | { ok: false; error: string };

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
  /** GDPR Art. 21 – se false il profilo non compare nella classifica pubblica. Default: true. */
  leaderboardVisible: boolean;
  /** Indica se il tutorial di benvenuto è stato completato. Default: false. */
  tutorialCompleted: boolean;
  /** ISO timestamp impostato quando l'utente completa (o bypassa) l'onboarding FTUE. Null = non ancora fatto. */
  onboardingCompletedAt: string | null;
  /** 'full' = ha giocato la prima missione; 'skipped_qr' = bypass via deep-link evento; 'skipped_manual' = ha saltato dal bottone "Salta". */
  onboardingVariant: 'full' | 'skipped_qr' | 'skipped_manual' | null;
  /** Statistiche skill guadagnate dai corsi (Issue #327). Valori iniziali: 0. */
  skills: {
    precision: number;
    presence: number;
    creativity: number;
    leadership: number;
  };
  /** Record dei corsi completati: courseId → timestamp ISO dell'ultimo completamento. */
  completedCourses: Record<string, string>;
  /** Corsi attualmente in corso: courseId → timestamp ISO di avvio. */
  activeCourses: Record<string, string>;
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

export type CatalogState = {
  roles: Role[];
  events: GameEvent[];
  activities: Activity[];
};
