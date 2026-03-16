import { useCallback, useMemo } from 'react';
import { Screen, Tab } from '../types/navigation';
import type { MobileFeatureFlagKey, MobileFeatureFlagsState } from '../services/feature-flags';

export interface TabFeatureFlags {
  turns: boolean;
  leaderboard: boolean;
  activities: boolean;
  shop: boolean;
  career: boolean;
  earnedTitles: boolean;
}

export function useFeatureGates(
  featureFlags: MobileFeatureFlagsState,
  isFeatureEnabled: (key: MobileFeatureFlagKey) => boolean,
) {
  const tabFlags = useMemo<TabFeatureFlags>(() => ({
    turns: featureFlags['mobile.section.turns'],
    leaderboard: featureFlags['mobile.section.leaderboard'],
    activities: featureFlags['mobile.section.activities'],
    shop: featureFlags['mobile.section.shop'],
    career: featureFlags['mobile.section.career'],
    earnedTitles: featureFlags['mobile.section.earned_titles'],
  }), [featureFlags]);

  const isTabEnabled = useCallback((tab: Tab) => {
    if (tab === 'home' || tab === 'profile') return true;
    if (tab === 'turns' || tab === 'activities') return tabFlags.turns || tabFlags.activities;
    if (tab === 'leaderboard') return tabFlags.leaderboard;
    if (tab === 'shop') return tabFlags.shop;
    return false;
  }, [tabFlags]);

  const isScreenEnabled = useCallback((screen: Screen) => {
    if (screen === 'turns' || screen === 'activities') return tabFlags.turns || tabFlags.activities;
    if (screen === 'leaderboard') return tabFlags.leaderboard;
    if (screen === 'activity-detail' || screen === 'activity-minigame' || screen === 'activity-result') return tabFlags.activities;
    if (screen === 'event-details') return tabFlags.turns;
    if (screen === 'shop') return tabFlags.shop;
    if (screen === 'career') return tabFlags.career;
    if (screen === 'earned-titles') return tabFlags.earnedTitles;
    if (screen === 'support') return isFeatureEnabled('mobile.action.ai_support');
    if (screen === 'qr-scanner') return isFeatureEnabled('mobile.action.qr_scan');
    if (screen === 'event-confirmation') return isFeatureEnabled('mobile.action.turn_submit');
    if (screen === 'ticket-qr-prototype') return isFeatureEnabled('mobile.dev.ticket_qr_prototype');
    return true;
  }, [isFeatureEnabled, tabFlags]);

  const showFeatureDisabledAlert = useCallback((label: string) => {
    window.alert(`${label} temporaneamente disattivata.`);
  }, []);

  const enabledNavTabs = useMemo<Tab[]>(() => {
    const tabs: Tab[] = ['home'];
    if (tabFlags.turns || tabFlags.activities) tabs.push('activities');
    if (tabFlags.leaderboard) tabs.push('leaderboard');
    if (tabFlags.shop) tabs.push('shop');
    tabs.push('profile');
    return tabs;
  }, [tabFlags]);

  return {
    tabFlags,
    isTabEnabled,
    isScreenEnabled,
    showFeatureDisabledAlert,
    enabledNavTabs,
    canViewAiSupport: isFeatureEnabled('mobile.action.ai_support'),
    canViewTicketQrPrototype: isFeatureEnabled('mobile.dev.ticket_qr_prototype'),
    roleJourneyEnabled: isFeatureEnabled('mobile.section.role_journey'),
  };
}
