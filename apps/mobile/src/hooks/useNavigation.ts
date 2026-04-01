import { useState, useEffect, useMemo, useRef } from 'react';
import { Screen, Tab, LegalReturnScreen, PersistedNavState } from '../types/navigation';
import { hasStoredAuthState, PUBLIC_SCREENS } from '../lib/auth-storage';
import { COOKIE_CONSENT_KEY } from '../constants/privacy';

const NAV_STATE_KEY = 'tdp-mobile-ui-nav';
const NAV_STATE_VERSION = 1 as const;

const VALID_SCREENS = new Set<Screen>([
    'cookie-consent',
    'welcome', 'login', 'signup', 'install', 'role-selection',
    'home', 'turns', 'leaderboard', 'qr-scanner', 'event-confirmation',
    'event-details', 'activities', 'shop', 'activity-detail', 'activity-minigame', 'activity-result', 'profile', 'public-profile',
    'account-settings', 'support', 'change-password', 'career',
    'terms', 'privacy', 'earned-titles',
    'ticket-qr-prototype',
]);

const VALID_TABS = new Set<Tab>(['home', 'turns', 'leaderboard', 'activities', 'shop', 'profile']);

const VALID_LEGAL_RETURN_SCREENS = new Set<LegalReturnScreen>([
    'cookie-consent',
    'welcome', 'login', 'signup', 'role-selection', 'home', 'turns',
    'qr-scanner', 'event-confirmation', 'activities', 'shop', 'activity-detail', 'activity-minigame', 'activity-result',
    'profile', 'account-settings', 'support', 'change-password',
    'career', 'earned-titles', 'ticket-qr-prototype',
]);

type UseNavigationOptions = {
    isScreenEnabled?: (screen: Screen) => boolean;
    isTabEnabled?: (tab: Tab) => boolean;
};

function readNavState(): PersistedNavState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(NAV_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PersistedNavState>;
        if (parsed.version !== NAV_STATE_VERSION) return null;
        if (!parsed.screen || !VALID_SCREENS.has(parsed.screen)) return null;
        if (!parsed.activeTab || !VALID_TABS.has(parsed.activeTab)) return null;
        if (!parsed.legalReturnScreen || !VALID_LEGAL_RETURN_SCREENS.has(parsed.legalReturnScreen)) return null;

        return {
            version: NAV_STATE_VERSION,
            screen: parsed.screen,
            activeTab: parsed.activeTab,
            legalReturnScreen: parsed.legalReturnScreen,
            scannedEventId: typeof parsed.scannedEventId === 'string' ? parsed.scannedEventId : '',
            selectedActivityId: typeof parsed.selectedActivityId === 'string' ? parsed.selectedActivityId : '',
        };
    } catch {
        return null;
    }
}

function writeNavState(state: PersistedNavState) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(NAV_STATE_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
}

function getScreenToPersist(screen: Screen, activeTab: Tab): Screen {
    if (screen === 'cookie-consent') {
        return 'welcome';
    }
    if (screen === 'install' || screen === 'qr-scanner') {
        return activeTab === 'home' ? 'home' : 'activities';
    }
    if (screen === 'public-profile') {
        return 'leaderboard';
    }
    if (screen === 'activity-minigame' || screen === 'activity-result') {
        return 'activities';
    }
    return screen;
}

function resolveFallbackTab(isTabEnabled?: (tab: Tab) => boolean): Tab {
    const fallbackOrder: Tab[] = ['home', 'profile', 'activities', 'leaderboard', 'shop', 'turns'];
    if (!isTabEnabled) return 'home';
    return fallbackOrder.find((candidate) => isTabEnabled(candidate)) ?? 'home';
}

function resolveFallbackScreen(isTabEnabled?: (tab: Tab) => boolean): Screen {
    return resolveFallbackTab(isTabEnabled);
}

export function useNavigation(initialEvents: { id: string }[], options?: UseNavigationOptions) {
    const isScreenEnabled = options?.isScreenEnabled;
    const isTabEnabled = options?.isTabEnabled;

    const persistedNavState = useMemo(() => {
        const persisted = readNavState();
        if (!persisted) return null;

        let nextTab = persisted.activeTab;
        if (isTabEnabled && !isTabEnabled(nextTab)) {
            nextTab = resolveFallbackTab(isTabEnabled);
        }

        let nextScreen = persisted.screen;
        if ((nextScreen === 'activity-detail' || nextScreen === 'activity-minigame' || nextScreen === 'activity-result') && !persisted.selectedActivityId) {
            nextScreen = 'activities';
        }
        if (nextScreen === 'event-confirmation' && !persisted.scannedEventId) nextScreen = 'activities';

        nextScreen = getScreenToPersist(nextScreen, nextTab);
        if (isScreenEnabled && !isScreenEnabled(nextScreen)) {
            nextScreen = resolveFallbackScreen(isTabEnabled);
        }

        if (!hasStoredAuthState() && !PUBLIC_SCREENS.has(nextScreen)) {
            return {
                ...persisted,
                screen: 'welcome' as const,
                activeTab: 'home' as const,
                legalReturnScreen: 'welcome' as const,
                scannedEventId: '',
                selectedActivityId: '',
            };
        }

        return {
            ...persisted,
            screen: nextScreen,
            activeTab: nextTab,
        };
    }, [isScreenEnabled, isTabEnabled]);

    const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
        if (typeof window !== 'undefined' && !window.localStorage.getItem(COOKIE_CONSENT_KEY)) {
            return 'cookie-consent';
        }
        return persistedNavState?.screen ?? 'welcome';
    });
    const [legalReturnScreen, setLegalReturnScreen] = useState<LegalReturnScreen>(() => persistedNavState?.legalReturnScreen ?? 'welcome');
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>(() => persistedNavState?.activeTab ?? 'home');
    const [scannedEventId, setScannedEventId] = useState<string>(() => persistedNavState?.scannedEventId ?? initialEvents[0]?.id ?? '');
    const [selectedActivityId, setSelectedActivityId] = useState<string>(() => persistedNavState?.selectedActivityId ?? '');

    const currentScreenRef = useRef(currentScreen);
    useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);

    useEffect(() => {
        if (isTabEnabled && !isTabEnabled(activeTab)) {
            const fallbackTab = resolveFallbackTab(isTabEnabled);
            setActiveTab(fallbackTab);
            if (!isScreenEnabled || !isScreenEnabled(currentScreen)) {
                setCurrentScreen(fallbackTab);
            }
            return;
        }

        if (isScreenEnabled && !isScreenEnabled(currentScreen)) {
            setCurrentScreen(resolveFallbackScreen(isTabEnabled));
        }
    }, [activeTab, currentScreen, isScreenEnabled, isTabEnabled]);

    useEffect(() => {
        const persistedTab = isTabEnabled && !isTabEnabled(activeTab)
            ? resolveFallbackTab(isTabEnabled)
            : activeTab;

        const persistedScreenRaw = getScreenToPersist(currentScreen, persistedTab);
        const persistedScreen = isScreenEnabled && !isScreenEnabled(persistedScreenRaw)
            ? resolveFallbackScreen(isTabEnabled)
            : persistedScreenRaw;

        writeNavState({
            version: NAV_STATE_VERSION,
            screen: persistedScreen,
            activeTab: persistedTab,
            legalReturnScreen,
            scannedEventId,
            selectedActivityId,
        });
    }, [activeTab, currentScreen, isScreenEnabled, isTabEnabled, legalReturnScreen, scannedEventId, selectedActivityId]);

    const handleTabChange = (tab: Tab) => {
        const nextTab = isTabEnabled && !isTabEnabled(tab) ? resolveFallbackTab(isTabEnabled) : tab;
        setActiveTab(nextTab);
        setCurrentScreen(nextTab);
    };

    return {
        currentScreen,
        setCurrentScreen,
        currentScreenRef,
        activeTab,
        setActiveTab,
        handleTabChange,
        legalReturnScreen,
        setLegalReturnScreen,
        isPasswordRecovery,
        setIsPasswordRecovery,
        scannedEventId,
        setScannedEventId,
        selectedActivityId,
        setSelectedActivityId,
    };
}
