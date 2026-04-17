import React, { createContext, useContext, useCallback } from 'react';
import { Screen, Tab, LegalReturnScreen } from '../types/navigation';
import { useNavigation } from '../hooks/useNavigation';

interface NavigatorContextValue {
  // Current state
  screen: Screen;
  activeTab: Tab;
  legalReturnScreen: LegalReturnScreen;
  isPasswordRecovery: boolean;
  scannedEventId: string;
  selectedActivityId: string;

  // Navigation actions
  navigate: (screen: Screen) => void;
  switchTab: (tab: Tab) => void;
  goBack: () => void;

  // Specific navigation helpers
  openLegal: (screen: 'terms' | 'privacy', returnTo: LegalReturnScreen) => void;

  // State setters (for advanced use)
  setIsPasswordRecovery: (value: boolean) => void;
  setScannedEventId: (id: string) => void;
  setSelectedActivityId: (id: string) => void;
  setLegalReturnScreen: (screen: LegalReturnScreen) => void;

  // Refs
  screenRef: React.RefObject<Screen>;
}

const NavigatorContext = createContext<NavigatorContextValue | null>(null);

interface NavigatorProviderProps {
  children: React.ReactNode;
  initialEvents: { id: string }[];
  isScreenEnabled?: (screen: Screen) => boolean;
  isTabEnabled?: (tab: Tab) => boolean;
  onTabChange?: (tab: Tab) => void;
}

const SCREENS_WITH_BACK: Partial<Record<Screen, Screen>> = {
  'login': 'welcome',
  'signup': 'welcome',
  'role-selection': 'welcome',
  'account-settings': 'profile',
  'change-password': 'account-settings',
  'support': 'account-settings',
  'career': 'profile',
  'earned-titles': 'profile',
  'event-details': 'home',
  'activity-detail': 'activities',
  'activity-minigame': 'activity-detail',
  'public-profile': 'leaderboard',
  'ticket-qr-prototype': 'account-settings',
};

export function NavigatorProvider({
  children,
  initialEvents,
  isScreenEnabled,
  isTabEnabled,
  onTabChange,
}: NavigatorProviderProps) {
  const {
    currentScreen, setCurrentScreen, currentScreenRef,
    activeTab, handleTabChange,
    legalReturnScreen, setLegalReturnScreen,
    isPasswordRecovery, setIsPasswordRecovery,
    scannedEventId, setScannedEventId,
    selectedActivityId, setSelectedActivityId,
  } = useNavigation(initialEvents, { isScreenEnabled, isTabEnabled });

  const navigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
  }, [setCurrentScreen]);

  const switchTab = useCallback((tab: Tab) => {
    handleTabChange(tab);
    onTabChange?.(tab);
  }, [handleTabChange, onTabChange]);

  const goBack = useCallback(() => {
    const screen = currentScreenRef.current;
    const backScreen = SCREENS_WITH_BACK[screen];
    if (backScreen) {
      setCurrentScreen(backScreen);
      return;
    }
    // For legal screens, return to where we came from
    if (screen === 'terms' || screen === 'privacy') {
      setCurrentScreen(legalReturnScreen);
      return;
    }
    // Default: go to home tab
    handleTabChange('home');
  }, [currentScreenRef, handleTabChange, legalReturnScreen, setCurrentScreen]);

  const openLegal = useCallback((screen: 'terms' | 'privacy', returnTo: LegalReturnScreen) => {
    setLegalReturnScreen(returnTo);
    setCurrentScreen(screen);
  }, [setCurrentScreen, setLegalReturnScreen]);

  const value: NavigatorContextValue = {
    screen: currentScreen,
    activeTab,
    legalReturnScreen,
    isPasswordRecovery,
    scannedEventId,
    selectedActivityId,
    navigate,
    switchTab,
    goBack,
    openLegal,
    setIsPasswordRecovery,
    setScannedEventId,
    setSelectedActivityId,
    setLegalReturnScreen,
    screenRef: currentScreenRef,
  };

  return (
    <NavigatorContext.Provider value={value}>
      {children}
    </NavigatorContext.Provider>
  );
}

export function useNavigator(): NavigatorContextValue {
  const ctx = useContext(NavigatorContext);
  if (!ctx) throw new Error('useNavigator must be used within NavigatorProvider');
  return ctx;
}
