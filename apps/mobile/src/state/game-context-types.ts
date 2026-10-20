import { type CourseSkill } from '../gameplay/courses';
import {
  type MobileFeatureFlagKey,
  type MobileFeatureFlagsSource,
  type MobileFeatureFlagsState,
} from '../services/feature-flags';
import type {
  RoleId,
  Role,
  GameEvent,
  EventPlanning,
  Activity,
  ShopCatalogItem,
  ActivitySlotsStatus,
  ActivityTelemetryInput,
  CompleteActivityResult,
  CompleteNarrativeChoiceInput,
  CompleteNarrativeChoiceResult,
  ShopPurchaseResult,
  PlayerProfile,
  RegisterTurnInput,
  RegisterTurnResult,
  TurnSyncFeedback,
  GameState,
  TurnStats,
  TheatreReputation,
  LeaderboardEntry,
  Badge,
} from './types';

export type GameContextValue = {
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
  updateProfile: (updates: Partial<Pick<PlayerProfile, 'name' | 'email' | 'roleId' | 'profileImage' | 'leaderboardVisible'>>) => void;
  registerTurn: (input: RegisterTurnInput) => Promise<RegisterTurnResult>;
  pendingBoostRequests: number;
  turnSyncFeedback: TurnSyncFeedback | null;
  clearTurnSyncFeedback: () => void;
  completeActivity: (
    activityId: string,
    telemetry?: ActivityTelemetryInput
  ) => Promise<CompleteActivityResult>;
  completeNarrativeChoice: (input: CompleteNarrativeChoiceInput) => Promise<CompleteNarrativeChoiceResult>;
  resetProgress: () => Promise<void>;
  /** GDPR Art. 17 – elimina account e tutti i dati dal server e dal dispositivo.
   *
   * ⚠️  **ATTENZIONE per i futuri call site**: se questo metodo viene chiamato senza
   * `options.onBeforeSignOut`, l'evento `SIGNED_OUT` emesso da `supabase.auth.signOut()`
   * causerà il banner «Sessione scaduta» in `useAuth`. Passare sempre `markVoluntaryLogout`
   * da `useAuth` come `onBeforeSignOut` — e `unmarkVoluntaryLogout` come `onSignOutFailed`
   * — per gestire correttamente sia il caso nominale che l'errore (issue #1124).
   *
   * @param options.onBeforeSignOut - invocato immediatamente prima di `signOut()`.
   *   Usare per impostare `isVoluntaryLogoutRef = true` in `useAuth`.
   * @param options.onSignOutFailed - invocato se `signOut()` lancia un'eccezione, prima
   *   di rithrowing. Usare per resettare `isVoluntaryLogoutRef = false` in `useAuth`
   *   (altrimenti il ref resta bloccato a `true` e la prossima scadenza involontaria
   *   della sessione non mostrerebbe il banner). */
  deleteAccount: (options?: { onBeforeSignOut?: () => void; onSignOutFailed?: () => void }) => Promise<void>;
  /** GDPR Art. 15/20 – scarica copia di tutti i dati personali in JSON. */
  exportUserData: () => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  completeTutorial: () => void;
  resetTutorial: () => void;
  /** Marca l'onboarding come completato e persiste su Supabase. Applica opzionalmente un bonus XP al profilo. */
  completeOnboarding: (variant: 'full' | 'skipped_qr' | 'skipped_manual', xpReward?: number) => void;
  /** Avvia un corso: scala il cachet e segna il corso come attivo. Issue #327. */
  startCourse: (courseId: string) => { ok: true } | { ok: false; error: string };
  /** Completa un corso attivo: assegna XP, incrementa la skill. Issue #327. */
  completeCourse: (courseId: string) => { ok: true; xpGained: number; skillGained: CourseSkill; pointsGained: number } | { ok: false; error: string };
  resetState: () => void;
};
