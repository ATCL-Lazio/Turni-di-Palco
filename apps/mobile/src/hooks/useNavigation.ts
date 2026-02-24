import { useState, useEffect, useMemo, useRef } from 'react';
import { Screen, Tab, LegalReturnScreen, PersistedNavState } from '../types/navigation';
import { hasStoredAuthState, PUBLIC_SCREENS } from '../lib/auth-storage';

const NAV_STATE_KEY = 'tdp-mobile-ui-nav';
const NAV_STATE_VERSION = 1 as const;

const VALID_SCREENS = new Set<Screen>([
    'welcome', 'login', 'signup', 'install', 'role-selection',
    'home', 'turns', 'leaderboard', 'qr-scanner', 'event-confirmation',
    'event-details', 'activities', 'shop', 'activity-detail', 'activity-minigame', 'activity-result', 'profile',
    'account-settings', 'support', 'change-password', 'career',
    'terms', 'privacy', 'earned-titles',
    'ticket-qr-prototype',
]);

const VALID_TABS = new Set<Tab>(['home', 'turns', 'leaderboard', 'activities', 'shop', 'profile']);

const VALID_LEGAL_RETURN_SCREENS = new Set<LegalReturnScreen>([
    'welcome', 'login', 'signup', 'role-selection', 'home', 'turns',
    'qr-scanner', 'event-confirmation', 'activities', 'shop', 'activity-detail', 'activity-minigame', 'activity-result',
    'profile', 'account-settings', 'support', 'change-password',
    'career', 'earned-titles', 'ticket-qr-prototype',
]);

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
            isPasswordRecovery: Boolean(parsed.isPasswordRecovery),
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
    if (screen === 'install' || screen === 'qr-scanner') {
        return activeTab === 'home' ? 'home' : 'turns';
    }
    if (screen === 'activity-minigame' || screen === 'activity-result') {
        return 'activities';
    }
    return screen;
}

export function useNavigation(initialEvents: { id: string }[]) {
    const persistedNavState = useMemo(() => {
        const persisted = readNavState();
        if (!persisted) return null;
        let nextScreen = persisted.screen;
        if ((nextScreen === 'activity-detail' || nextScreen === 'activity-minigame' || nextScreen === 'activity-result') && !persisted.selectedActivityId) {
            nextScreen = 'activities';
        }
        if (nextScreen === 'event-confirmation' && !persisted.scannedEventId) nextScreen = 'turns';
        nextScreen = getScreenToPersist(nextScreen, persisted.activeTab);
        if (!hasStoredAuthState() && !PUBLIC_SCREENS.has(nextScreen)) {
            return {
                ...persisted,
                screen: 'welcome' as const,
                activeTab: 'home' as const,
                legalReturnScreen: 'welcome' as const,
                isPasswordRecovery: false,
                scannedEventId: '',
                selectedActivityId: '',
            };
        }
        return { ...persisted, screen: nextScreen };
    }, []);

    const [currentScreen, setCurrentScreen] = useState<Screen>(() => persistedNavState?.screen ?? 'welcome');
    const [legalReturnScreen, setLegalReturnScreen] = useState<LegalReturnScreen>(() => persistedNavState?.legalReturnScreen ?? 'welcome');
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => persistedNavState?.isPasswordRecovery ?? false);
    const [activeTab, setActiveTab] = useState<Tab>(() => persistedNavState?.activeTab ?? 'home');
    const [scannedEventId, setScannedEventId] = useState<string>(() => persistedNavState?.scannedEventId ?? initialEvents[0]?.id ?? '');
    const [selectedActivityId, setSelectedActivityId] = useState<string>(() => persistedNavState?.selectedActivityId ?? '');

    const currentScreenRef = useRef(currentScreen);
    useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);

    useEffect(() => {
        writeNavState({
            version: NAV_STATE_VERSION,
            screen: getScreenToPersist(currentScreen, activeTab),
            activeTab,
            legalReturnScreen,
            isPasswordRecovery,
            scannedEventId,
            selectedActivityId,
        });
    }, [activeTab, currentScreen, isPasswordRecovery, legalReturnScreen, scannedEventId, selectedActivityId]);

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        setCurrentScreen(tab);
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
