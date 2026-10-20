// Maximum number of turns the mobile client keeps in memory/uses for a game session.
// This is intentionally bounded to avoid unbounded state growth on long‑running devices
// and to keep UI and sync operations predictable.
export const MAX_TURNS = 20;

// Per‑operation watchdog timeouts (in ms) for network/API calls.
// Values are tuned based on typical Supabase and backend response times on mobile networks:
// short enough to detect hangs and surface errors, but long enough to tolerate
// transient latency spikes without failing normal requests.
export const MOBILE_WATCHDOG_TIMEOUTS = {
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
