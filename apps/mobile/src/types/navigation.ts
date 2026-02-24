export type Screen =
    | 'welcome'
    | 'login'
    | 'signup'
    | 'install'
    | 'role-selection'
    | 'home'
    | 'turns'
    | 'leaderboard'
    | 'qr-scanner'
    | 'event-confirmation'
    | 'event-details'
    | 'activities'
    | 'shop'
    | 'activity-detail'
    | 'activity-minigame'
    | 'activity-result'
    | 'profile'
    | 'account-settings'
    | 'support'
    | 'change-password'
    | 'career'
    | 'terms'
    | 'privacy'
    | 'earned-titles'
    | 'ticket-qr-prototype';

export type Tab = 'home' | 'turns' | 'leaderboard' | 'activities' | 'shop' | 'profile';

export type LegalReturnScreen = Exclude<Screen, 'terms' | 'privacy'>;

export type PersistedNavState = {
    version: number;
    screen: Screen;
    activeTab: Tab;
    legalReturnScreen: LegalReturnScreen;
    isPasswordRecovery: boolean;
    scannedEventId: string;
    selectedActivityId: string;
};
