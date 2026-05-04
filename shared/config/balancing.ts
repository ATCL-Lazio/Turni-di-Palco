/**
 * Centralized balancing constants for Turni di Palco.
 *
 * Closes the configuration scope of issue #475. Every numeric value that
 * influences economy, progression or pacing should live here so that game
 * designers can re-tune the game without redeploying touched components.
 *
 * Notes for future contributors:
 * - Numbers below are PLACEHOLDERS validated against the principles spelled
 *   out in #475. Treat them as the starting point for playtest tuning.
 * - When you add a new tunable, prefer extending the relevant block here over
 *   sprinkling literals in components or stores.
 * - Keep types narrow (`as const`) so consumers get autocompletion on keys.
 */

export type ActivityKind =
  | 'narrative_scene'
  | 'minigame_completion'
  | 'minigame_perfect'
  | 'course_completion';

export type ActivityRewardSpec = Readonly<{
  /** Inclusive XP range awarded on success. */
  xp: Readonly<{ min: number; max: number }>;
  /** Inclusive cachet range awarded on success. */
  cachet: Readonly<{ min: number; max: number }>;
  /** Cooldown before the activity can be performed again, in minutes. */
  cooldownMinutes: number;
}>;

/**
 * Reward table proposed in #475.
 *
 *   Activity                | XP     | Cachet | Cooldown
 *   ------------------------|--------|--------|---------
 *   Scenario narrativo      | 15-30  | 5-15   | 6h
 *   Minigioco completamento | 20-50  | 10-25  | 4h
 *   Minigioco perfect score | 50-80  | 25-40  | 4h
 *   Corso formazione        | 100    | 0      | 3 giorni
 */
export const ACTIVITY_REWARDS: Readonly<Record<ActivityKind, ActivityRewardSpec>> = {
  narrative_scene: {
    xp: { min: 15, max: 30 },
    cachet: { min: 5, max: 15 },
    cooldownMinutes: 6 * 60,
  },
  minigame_completion: {
    xp: { min: 20, max: 50 },
    cachet: { min: 10, max: 25 },
    cooldownMinutes: 4 * 60,
  },
  minigame_perfect: {
    xp: { min: 50, max: 80 },
    cachet: { min: 25, max: 40 },
    cooldownMinutes: 4 * 60,
  },
  course_completion: {
    xp: { min: 100, max: 100 },
    cachet: { min: 0, max: 0 },
    cooldownMinutes: 3 * 24 * 60,
  },
} as const;

/**
 * Level progression curve (cumulative XP needed to reach the upper bound of
 * each band). Aligned with the principle "a player doing only simulated
 * activities reaches level 10 in roughly one month".
 *
 * The runtime curve in `state/store.tsx` (`800 + level * 200`) is consistent
 * with these totals; consolidate via `getXpToNextLevel` below.
 */
export const LEVEL_PROGRESSION = {
  /** Base XP to clear level 1 → 2. */
  baseXpToNextLevel: 1000,
  /** Linear coefficient: each new level adds `linearGrowthPerLevel` XP. */
  linearGrowthPerLevel: 200,
  /** Soft minimum that the curve cannot drop below. */
  floorXpToNextLevel: 800,
  /** Reference cumulative XP totals used for content sizing. */
  cumulativeMilestones: {
    level5: 500,
    level10: 1500,
    level20: 5000,
    level50: 25000,
  },
} as const;

/**
 * Stat → effect coefficients, sliced from #471 so that #475 owns "every
 * number that matters". Consumers (minigames, narrative, rewards) MUST read
 * from here rather than hard-coding per-feature multipliers.
 *
 * `cap` values are absolute bonuses (e.g. `0.20` = +20%), `perPoint` values
 * apply to the delta between the current stat and `statBaseline`.
 */
export const STAT_EFFECTS = {
  /** Stats are normalized in [0, 100]; bonuses kick in above this baseline. */
  statBaseline: 50,
  precision: {
    /** Extra timing window granted per stat point above baseline (ms). */
    timingWindowBonusMs: 4,
    /** Cachet multiplier earned per stat point above baseline. */
    cachetMultPerPoint: 0.003,
    cachetMultCap: 0.2,
    affectedActivities: ['luci', 'fonico', 'sequenza_luci', 'equalizzazione'] as const,
  },
  presence: {
    /** Combo bonus threshold; below this, no extra combo points. */
    comboBonusThreshold: 80,
    comboBonusPerHit: 1,
    /** XP multiplier earned per stat point above baseline. */
    xpMultPerPoint: 0.004,
    xpMultCap: 0.2,
    affectedActivities: ['recitazione', 'copione'] as const,
  },
  leadership: {
    multiPhaseTimeBonusThreshold: 75,
    multiPhaseTimeBonusSeconds: 2,
    /** Global cachet multiplier (applies to every activity). */
    cachetMultPerPoint: 0.002,
    cachetMultCap: 0.1,
  },
  creativity: {
    improviseRoundUnlockThreshold: 70,
    /** XP multiplier earned per stat point above baseline. */
    xpMultPerPoint: 0.003,
    xpMultCap: 0.2,
    affectedActivities: ['palco', 'attrezzista'] as const,
  },
} as const;

/**
 * Daily / weekly activity caps. The numbers exist to validate the principle
 * "1 corso ogni 2 settimane di gioco attivo" without inventing them ad-hoc
 * inside scheduling code.
 */
export const ACTIVITY_PACING = {
  dailySimulatedActivitySlots: 6,
  weeklyTargetActivities: 30,
  cachetTargetPerTwoWeeks: 1500,
} as const;

/**
 * XP needed to advance from `level` to `level + 1`.
 *
 * Mirrors the curve currently used at `apps/mobile/src/state/store.tsx`
 * (`800 + level * 200`) so a single change here propagates everywhere once
 * the store starts importing this helper.
 */
export function getXpToNextLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return LEVEL_PROGRESSION.baseXpToNextLevel;
  const linear =
    LEVEL_PROGRESSION.floorXpToNextLevel +
    Math.floor(level) * LEVEL_PROGRESSION.linearGrowthPerLevel;
  return Math.max(LEVEL_PROGRESSION.floorXpToNextLevel, linear);
}

/**
 * Multiplier (>= 1) earned by a single stat over the baseline, capped.
 * Returns `1` when the stat is at or below baseline, or when the stat config
 * does not define a multiplier (e.g. `leadership.cachetMultPerPoint` only).
 */
export function getStatMultiplier(
  axis: 'precision' | 'presence' | 'creativity',
  kind: 'xp' | 'cachet',
  statValue: number,
): number {
  const cfg = STAT_EFFECTS[axis];
  const delta = Math.max(0, statValue - STAT_EFFECTS.statBaseline);
  if (delta === 0) return 1;

  if (axis === 'precision' && kind === 'cachet') {
    return 1 + Math.min(cfg.cachetMultCap, cfg.cachetMultPerPoint * delta);
  }
  if ((axis === 'presence' || axis === 'creativity') && kind === 'xp') {
    return 1 + Math.min(cfg.xpMultCap, cfg.xpMultPerPoint * delta);
  }
  return 1;
}

/**
 * Global leadership cachet multiplier, applied on top of activity-specific
 * bonuses (#471 — "+0.2% cachet globale per punto sopra 50, cap +10%").
 */
export function getLeadershipCachetMultiplier(statValue: number): number {
  const delta = Math.max(0, statValue - STAT_EFFECTS.statBaseline);
  if (delta === 0) return 1;
  const cfg = STAT_EFFECTS.leadership;
  return 1 + Math.min(cfg.cachetMultCap, cfg.cachetMultPerPoint * delta);
}
