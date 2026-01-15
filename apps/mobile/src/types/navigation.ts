export type Screen =
    | 'welcome'
    | 'login'
    | 'signup'
    | 'install'
    | 'role-selection'
    | 'home'
    | 'turni'
    | 'leaderboard'
    | 'qr-scanner'
    | 'event-confirmation'
    | 'event-details'
    | 'attivita'
    | 'activity-detail'
    | 'profilo'
    | 'account-settings'
    | 'support'
    | 'change-password'
    | 'carriera'
    | 'terms'
    | 'privacy'
    | 'titoli-ottenuti';

export type Tab = 'home' | 'turni' | 'leaderboard' | 'attivita' | 'profilo';

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
