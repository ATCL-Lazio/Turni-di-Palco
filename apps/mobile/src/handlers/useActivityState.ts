import { useState, useMemo } from 'react';
import { Activity, Rewards, Role, RoleId } from '../state/store';
import { MinigameOutcome, isMinigameAvailableForRole } from '../gameplay/minigames';
import type { ActivitiesHubSection } from '../components/screens/ActivitiesHub';

export function useActivityState(
  activities: Activity[],
  roles: Role[],
  profileRoleId: RoleId,
  roleJourneyEnabled: boolean,
) {
  const [activityOutcome, setActivityOutcome] = useState<MinigameOutcome | null>(null);
  const [activityCompletion, setActivityCompletion] = useState<{ activity: Activity; rewards: Rewards } | null>(null);
  const [activitiesSection, setActivitiesSection] = useState<ActivitiesHubSection>('activities');

  const selectedRole = useMemo(
    () => roles.find(role => role.id === profileRoleId),
    [roles, profileRoleId],
  );

  const recommendedActivityId = roleJourneyEnabled
    ? selectedRole?.profile?.journey?.recommendedActivityId
    : undefined;

  const visibleActivities = useMemo(() => {
    const baseActivities = activities.filter(activity => isMinigameAvailableForRole(activity.id, null));
    if (!roleJourneyEnabled || !selectedRole) return baseActivities;

    const allowedActivityIds = selectedRole.profile?.allowedActivityIds;
    const orderedActivityIds = selectedRole.profile?.activityOrder ?? [];
    const orderedIndexById = new Map(orderedActivityIds.map((id, i) => [id, i]));
    const defaultIndexById = new Map(activities.map((a, i) => [a.id, i]));

    return activities
      .filter(a => isMinigameAvailableForRole(a.id, selectedRole.id))
      .filter(a => !allowedActivityIds?.length || allowedActivityIds.includes(a.id))
      .sort((left, right) => {
        const leftRec = left.id === recommendedActivityId ? 1 : 0;
        const rightRec = right.id === recommendedActivityId ? 1 : 0;
        if (leftRec !== rightRec) return rightRec - leftRec;

        const leftOrder = orderedIndexById.get(left.id);
        const rightOrder = orderedIndexById.get(right.id);
        if (leftOrder != null || rightOrder != null) {
          if (leftOrder == null) return 1;
          if (rightOrder == null) return -1;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        }

        return (defaultIndexById.get(left.id) ?? 0) - (defaultIndexById.get(right.id) ?? 0);
      });
  }, [activities, recommendedActivityId, roleJourneyEnabled, selectedRole]);

  const roleJourney = useMemo(() => {
    if (!roleJourneyEnabled) return null;
    const journey = selectedRole?.profile?.journey;
    if (!journey) return null;

    return {
      eyebrow: journey.eyebrow,
      headline: journey.headline,
      summary: journey.summary,
      recommendedActivityTitle: visibleActivities.find(a => a.id === journey.recommendedActivityId)?.title,
      starterBadgeLabels: journey.starterBadgeLabels,
      objectives: journey.objectives,
      homeMessage: selectedRole?.profile?.homeMessage,
      ctaLabel: journey.homeCtaLabel,
    };
  }, [roleJourneyEnabled, selectedRole, visibleActivities]);

  return {
    activityOutcome, setActivityOutcome,
    activityCompletion, setActivityCompletion,
    activitiesSection, setActivitiesSection,
    selectedRole,
    recommendedActivityId,
    visibleActivities,
    roleJourney,
  };
}
