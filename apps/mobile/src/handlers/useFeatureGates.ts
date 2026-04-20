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
  onFeatureDisabled?: (message: string) => void,
) {
  const tabFlags = useMemo<TabFeatureFlags>(() => ({
    turns: featureFlags['turni'],
    leaderboard: featureFlags['classifica'],
    activities: featureFlags['attivita'],
    shop: featureFlags['shop'],
    career: featureFlags['carriera'],
    earnedTitles: featureFlags['titoli'],
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
    if (screen === 'support') return isFeatureEnabled('supporto_ai');
    if (screen === 'qr-scanner') return isFeatureEnabled('qr_scan');
    if (screen === 'event-confirmation') return isFeatureEnabled('registra_turno');
    if (screen === 'ticket-qr-prototype') return isFeatureEnabled('ticket_qr');
    return true;
  }, [isFeatureEnabled, tabFlags]);

  const showFeatureDisabledAlert = useCallback((label: string) => {
    const message = `${label} temporaneamente disattivata.`;
    if (onFeatureDisabled) {
      onFeatureDisabled(message);
    } else {
      // Fallback for contexts where no in-app handler is provided.
      // In production AppShell always passes onFeatureDisabled.
      if (import.meta.env.DEV) console.warn('[useFeatureGates]', message);
    }
  }, [onFeatureDisabled]);

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
    canViewAiSupport: isFeatureEnabled('supporto_ai'),
    canViewTicketQrPrototype: isFeatureEnabled('ticket_qr'),
    roleJourneyEnabled: isFeatureEnabled('percorso_ruolo'),
  };
}
