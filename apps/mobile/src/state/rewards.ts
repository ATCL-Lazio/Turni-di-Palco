import {
  getXpToNextLevel,
  getStatMultiplier,
  getLeadershipCachetMultiplier,
  STAT_EFFECTS,
} from '../../../../shared/config/balancing';
import type {
  RoleId,
  Rewards,
  RoleActivityOverride,
  Role,
  GameEvent,
  Activity,
  PlayerProfile,
} from './types';

export function getRoleActivityOverride(
  role: Role | null | undefined,
  activityId: string
): RoleActivityOverride | undefined {
  return role?.profile?.activityOverrides?.[activityId];
}

export function computeActivityRewards(
  activity: Activity,
  role: Role | null | undefined,
  skills?: { precision: number; presence: number; creativity: number; leadership: number } | null,
): Rewards {
  const override = getRoleActivityOverride(role, activity.id);
  const xpMultiplier = override?.xpMultiplier ?? 1;
  const cachetMultiplier = override?.cachetMultiplier ?? 1;
  const reputationBonus = override?.reputationBonus ?? 0;

  // Applica bonus skill derivati dai corsi completati (Issue #327).
  // Gate each multiplier on the activity type, mirroring computeRewardBreakdown
  // in role-effects.ts (closes #1594). Leadership is global (always applied).
  let skillXpMult = 1;
  let skillCachetMult = 1;
  if (skills) {
    const presenceActivities = STAT_EFFECTS.presence.affectedActivities as readonly string[];
    const creativityActivities = STAT_EFFECTS.creativity.affectedActivities as readonly string[];
    const precisionActivities = STAT_EFFECTS.precision.affectedActivities as readonly string[];
    const presenceMult = presenceActivities.includes(activity.id)
      ? getStatMultiplier('presence', 'xp', skills.presence)
      : 1;
    const creativityMult = creativityActivities.includes(activity.id)
      ? getStatMultiplier('creativity', 'xp', skills.creativity)
      : 1;
    skillXpMult = presenceMult * creativityMult;
    const precisionMult = precisionActivities.includes(activity.id)
      ? getStatMultiplier('precision', 'cachet', skills.precision)
      : 1;
    skillCachetMult = precisionMult * getLeadershipCachetMultiplier(skills.leadership);
  }

  return {
    xp: Math.max(0, Math.round(activity.xpReward * xpMultiplier * skillXpMult)),
    cachet: Math.max(0, Math.round(activity.cachetReward * cachetMultiplier * skillCachetMult)),
    reputation: Math.max(0, 5 + reputationBonus),
  };
}

export function applyRewards(profile: PlayerProfile, rewards: Rewards, source: 'turn' | 'activity'): PlayerProfile {
  let nextXp = profile.xp + rewards.xp;
  let nextLevel = profile.level;
  let nextThreshold = profile.xpToNextLevel;

  while (nextXp >= nextThreshold) {
    nextXp -= nextThreshold;
    nextLevel += 1;
    nextThreshold = getXpToNextLevel(nextLevel);
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
