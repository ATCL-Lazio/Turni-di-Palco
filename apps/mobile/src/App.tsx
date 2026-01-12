import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { Welcome } from './components/screens/Welcome';
import { Login } from './components/screens/Login';
import { Signup } from './components/screens/Signup';
import { RoleSelection } from './components/screens/RoleSelection';
import { Home } from './components/screens/Home';
import { TurniATCL } from './components/screens/TurniATCL';
import { QRScanner } from './components/screens/QRScanner';
import { EventConfirmation } from './components/screens/EventConfirmation';
import { EventDetails } from './components/screens/EventDetails';
import { Attivita } from './components/screens/Attivita';
import { ActivityDetail } from './components/screens/ActivityDetail';
import { Leaderboard } from './components/screens/Leaderboard';
import { Profilo } from './components/screens/Profilo';
import { AccountSettings } from './components/screens/AccountSettings';
import { ChangePassword } from './components/screens/ChangePassword';
import { Carriera } from './components/screens/Carriera';
import { TermsAndConditions } from './components/screens/TermsAndConditions';
import { PrivacyPolicy } from './components/screens/PrivacyPolicy';
import { TitoliOttenuti } from './components/screens/TitoliOttenuti';
import { GameStateProvider, useGameState } from './state/store';
import { isSupabaseConfigured, supabase } from './lib/supabase';


type Screen =
  | 'welcome'
  | 'login'
  | 'signup'
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
  | 'change-password'
  | 'carriera'
  | 'terms'
  | 'privacy'
  | 'titoli-ottenuti';

type Tab = 'home' | 'turni' | 'leaderboard' | 'attivita' | 'profilo';

type LegalReturnScreen = Exclude<Screen, 'terms' | 'privacy'>;

const NAV_STATE_KEY = 'tdp-mobile-ui-nav';
const NAV_STATE_VERSION = 1 as const;

type PersistedNavState = {
  version: typeof NAV_STATE_VERSION;
  screen: Screen;
  activeTab: Tab;
  legalReturnScreen: LegalReturnScreen;
  isPasswordRecovery: boolean;
  scannedEventId: string;
  selectedActivityId: string;
};

const VALID_SCREENS = new Set<Screen>([
  'welcome',
  'login',
  'signup',
  'role-selection',
  'home',
  'turni',
  'leaderboard',
  'qr-scanner',
  'event-confirmation',
  'event-details',
  'attivita',
  'activity-detail',
  'profilo',
  'account-settings',
  'change-password',
  'carriera',
  'terms',
  'privacy',
  'titoli-ottenuti',
]);

const VALID_TABS = new Set<Tab>(['home', 'turni', 'leaderboard', 'attivita', 'profilo']);

const VALID_LEGAL_RETURN_SCREENS = new Set<LegalReturnScreen>([
  'welcome',
  'login',
  'signup',
  'role-selection',
  'home',
  'turni',
  'qr-scanner',
  'event-confirmation',
  'attivita',
  'activity-detail',
  'profilo',
  'account-settings',
  'change-password',
  'carriera',
  'titoli-ottenuti',
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
    // ignore quota/security errors
  }
}

function getScreenToPersist(screen: Screen, activeTab: Tab): Screen {
  if (screen === 'qr-scanner') {
    return activeTab === 'home' ? 'home' : 'turni';
  }
  return screen;
}

function AppShell() {
  const {
    authUserId,
    state,
    roles,
    events,
    activities,
    turnStats,
    statsLoading,
    theatreReputation,
    theatreReputationLoading,
    badges,
    followedEvents,
    followedEventsLoading,
    followEvent,
    unfollowEvent,
    isEventFollowed,
    markBadgesSeen,
    updateProfile,
    registerTurn,
    completeActivity,
    resetProgress,
    changePassword,
    sendPasswordResetEmail,
  } = useGameState();

  const persistedNavState = useMemo(() => {
    const persisted = readNavState();
    if (!persisted) return null;
    let nextScreen = persisted.screen;
    if (nextScreen === 'activity-detail' && !persisted.selectedActivityId) {
      nextScreen = 'attivita';
    }
    if (nextScreen === 'event-confirmation' && !persisted.scannedEventId) {
      nextScreen = 'turni';
    }
    nextScreen = getScreenToPersist(nextScreen, persisted.activeTab);
    return { ...persisted, screen: nextScreen };
  }, []);

  const [currentScreen, setCurrentScreen] = useState<Screen>(() => persistedNavState?.screen ?? 'welcome');
  const [legalReturnScreen, setLegalReturnScreen] = useState<LegalReturnScreen>(() => persistedNavState?.legalReturnScreen ?? 'welcome');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => persistedNavState?.isPasswordRecovery ?? false);
  const [activeTab, setActiveTab] = useState<Tab>(() => persistedNavState?.activeTab ?? 'home');
  const [scannedEventId, setScannedEventId] = useState<string>(() => persistedNavState?.scannedEventId ?? events[0]?.id ?? '');
  const [selectedActivityId, setSelectedActivityId] = useState<string>(() => persistedNavState?.selectedActivityId ?? '');
  const [authError, setAuthError] = useState<string | null>(null);
  const currentScreenRef = useRef(currentScreen);

  const upcomingEvent = useMemo(() => followedEvents[0], [followedEvents]);
  const unlockedBadges = useMemo(() => badges.filter((badge) => badge.unlocked), [badges]);
  const newBadges = useMemo(() => unlockedBadges.filter((badge) => !badge.seenAt), [unlockedBadges]);
  const theatreReputationForProfile = useMemo(
    () => theatreReputation.map((entry) => ({ name: entry.theatre, reputation: entry.reputation })),
    [theatreReputation]
  );
  const newestNewBadge = useMemo(() => {
    if (!newBadges.length) return null;
    return [...newBadges].sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))[0];
  }, [newBadges]);

  useEffect(() => {
    if (!events.length) {
      if (scannedEventId) {
        setScannedEventId('');
      }
      return;
    }
    if (!scannedEventId || !events.some((event) => event.id === scannedEventId)) {
      setScannedEventId(events[0].id);
    }
  }, [events, scannedEventId]);

  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

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

  const handleStart = () => setCurrentScreen('signup');

  const handleLogin = async (email: string, password: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      updateProfile({ email });
      setCurrentScreen('home');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return;
    }

    const displayName = data.user?.user_metadata?.name ?? state.profile.name;
    updateProfile({ name: displayName, email });
    setCurrentScreen('home');
  };

  const handleSignup = async (name: string, email: string, password: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      updateProfile({ name, email });
      setCurrentScreen('role-selection');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      setAuthError(error.message);
      return;
    }

    const displayName = data.user?.user_metadata?.name ?? name;
    updateProfile({ name: displayName, email });
    setCurrentScreen('role-selection');
  };

  const handleRoleComplete = (roleId: string) => {
    updateProfile({ roleId: roleId as typeof state.profile.roleId });
    setCurrentScreen('home');
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home':
        setCurrentScreen('home');
        break;
      case 'turni':
        setCurrentScreen('turni');
        break;
      case 'leaderboard':
        setCurrentScreen('leaderboard');
        break;
      case 'attivita':
        setCurrentScreen('attivita');
        break;
      case 'profilo':
        setCurrentScreen('profilo');
        break;
    }
  };

  const handleQRScanAttempt = (code: string) => {
    if (!events.length) {
      return { ok: false as const, error: 'Nessun evento disponibile al momento.' };
    }
    const resolved = events.find((event) => code.toLowerCase().includes(event.id.toLowerCase()));
    if (!resolved) {
      return { ok: false as const, error: 'Questo QR non sembra appartenere a un biglietto ATCL.' };
    }

    setScannedEventId(resolved.id);
    setCurrentScreen('event-confirmation');
    return { ok: true as const };
  };

  const handleEventConfirm = () => {
    const resolvedRoleId = state.profile.roleId;
    const record = registerTurn(scannedEventId, resolvedRoleId);
    if (record) {
      setCurrentScreen('home');
      setActiveTab('home');
    }
  };

  const handleStartActivity = (activityId: string) => {
    setSelectedActivityId(activityId);
    setCurrentScreen('activity-detail');
  };

  const handleActivityStart = () => {
    if (selectedActivityId) {
      completeActivity(selectedActivityId);
    }
    setCurrentScreen('attivita');
    setActiveTab('attivita');
  };

  const handleViewCarriera = () => {
    setCurrentScreen('carriera');
  };

  const handleViewEventDetails = () => {
    if (!upcomingEvent) return;
    setScannedEventId(upcomingEvent.id);
    setCurrentScreen('event-details');
  };

  const handleNavigateToEvent = (event?: { theatre: string } | null) => {
    const targetEvent = event ?? upcomingEvent;
    if (!targetEvent) return;
    const destination = encodeURIComponent(targetEvent.theatre);
    if (typeof window === 'undefined') return;
    const isAppleDevice = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    if (isAppleDevice) {
      window.location.href = `maps://?q=${destination}`;
      return;
    }
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = `geo:0,0?q=${destination}`;
      return;
    }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener');
  };

  const handleViewEventsMap = () => {
    if (typeof window === 'undefined') return;
    const uniqueTheatres = Array.from(new Set(events.map((event) => event.theatre).filter(Boolean)));
    if (!uniqueTheatres.length) return;
    const origin = encodeURIComponent('My Location');
    const destination = encodeURIComponent(uniqueTheatres[uniqueTheatres.length - 1]);
    const waypoints = uniqueTheatres
      .slice(0, -1)
      .map((value) => encodeURIComponent(value))
      .join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
      waypoints ? `&waypoints=${waypoints}` : ''
    }`;
    window.location.href = url;
  };

  const handleToggleFollow = (eventId: string) => {
    if (isEventFollowed(eventId)) {
      void unfollowEvent(eventId);
    } else {
      void followEvent(eventId);
    }
  };

  const handleViewTitoli = () => {
    setCurrentScreen('titoli-ottenuti');
  };

  const handleViewAccountSettings = () => {
    setCurrentScreen('account-settings');
  };

  const openTerms = (from: LegalReturnScreen) => {
    setLegalReturnScreen(from);
    setCurrentScreen('terms');
  };

  const openPrivacy = (from: LegalReturnScreen) => {
    setLegalReturnScreen(from);
    setCurrentScreen('privacy');
  };

  const handleLogout = () => {
    if (supabase) {
      supabase.auth.signOut();
    }
    setIsPasswordRecovery(false);
    setCurrentScreen('welcome');
    setActiveTab('home');
  };

  const handleUploadProfileImage = async (file: File) => {
    if (!supabase || !authUserId) {
      throw new Error('Supabase non configurato o utente non autenticato');
    }

    // Create a unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${authUserId}/profile.${fileExt}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    if (!urlData.publicUrl) {
      throw new Error('Impossibile ottenere l\'URL pubblico');
    }

    // Update profile with the image URL
    updateProfile({ profileImage: urlData.publicUrl });
  };

  const handleResetProgress = async () => {
    if (typeof window === 'undefined') return;
    try {
      await resetProgress();
      setActiveTab('home');
      setCurrentScreen('role-selection');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      window.alert(`Impossibile resettare i progressi: ${message}`);
    }
  };

  const handleCloseChangePassword = () => {
    setIsPasswordRecovery(false);
    setCurrentScreen(isPasswordRecovery ? 'home' : 'account-settings');
  };

  useEffect(() => {
    setAuthError(null);
  }, [currentScreen]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || error) return;
      if (data.session?.user) {
        const user = data.session.user;
        const displayName = user.user_metadata?.name ?? state.profile.name;
        updateProfile({ name: displayName, email: user.email ?? state.profile.email });
        const shouldAutoHome =
          currentScreenRef.current === 'welcome' || currentScreenRef.current === 'login';
        if (shouldAutoHome) {
          setCurrentScreen('home');
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        setCurrentScreen('welcome');
        setActiveTab('home');
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        if (session?.user) {
          const displayName = session.user.user_metadata?.name ?? state.profile.name;
          updateProfile({ name: displayName, email: session.user.email ?? state.profile.email });
        }
        setIsPasswordRecovery(true);
        setCurrentScreen('change-password');
        return;
      }
      if (session?.user) {
        const displayName = session.user.user_metadata?.name ?? state.profile.name;
        updateProfile({ name: displayName, email: session.user.email ?? state.profile.email });
        const shouldAutoHome =
          currentScreenRef.current === 'welcome' || currentScreenRef.current === 'login';
        if (shouldAutoHome) {
          setCurrentScreen('home');
        }
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [updateProfile, state.profile.email, state.profile.name]);

  const selectedEvent = events.find((event) => event.id === scannedEventId) ?? undefined;
  const currentActivity = activities.find((item) => item.id === selectedActivityId);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'welcome':
        return <Welcome onStart={handleStart} onLogin={() => setCurrentScreen('login')} />;

      case 'login':
        return (
          <Login
            onBack={() => setCurrentScreen('welcome')}
            onLogin={handleLogin}
            onSignup={() => setCurrentScreen('signup')}
            onForgotPassword={() => undefined}
            errorMessage={authError}
          />
        );

      case 'signup':
        return (
          <Signup
            onBack={() => setCurrentScreen('welcome')}
            onSignup={handleSignup}
            onLogin={() => setCurrentScreen('login')}
            onViewTerms={() => openTerms('signup')}
            onViewPrivacy={() => openPrivacy('signup')}
            errorMessage={authError}
          />
        );

      case 'role-selection':
        return <RoleSelection roles={roles} onComplete={(role) => handleRoleComplete(role.id)} />;

      case 'home':
        return (
          <Home
            userName={state.profile.name}
            userRole={roles.find((role) => role.id === state.profile.roleId)?.name ?? 'Ruolo'}
            level={state.profile.level}
            xp={state.profile.xp}
            xpToNextLevel={state.profile.xpToNextLevel}
            reputation={state.profile.reputation}
            onScanQR={() => setCurrentScreen('qr-scanner')}
            onViewActivities={() => handleTabChange('attivita')}
            onViewTurni={() => handleTabChange('turni')}
            onViewEventDetails={handleViewEventDetails}
            onNavigateToEvent={() => handleNavigateToEvent(upcomingEvent)}
            upcomingEvent={upcomingEvent}
            totalTurns={turnStats.totalTurns}
            turnsThisMonth={turnStats.turnsThisMonth}
            uniqueTheatres={turnStats.uniqueTheatres}
            activitiesCount={activities.length}
            eventLoading={followedEventsLoading}
            statsLoading={statsLoading}
            newBadgesCount={newBadges.length}
            newBadgeTitle={newestNewBadge?.title ?? undefined}
            onDismissBadgeNotification={markBadgesSeen}
          />
        );

      case 'turni':
        return (
          <TurniATCL
            events={events}
            isEventFollowed={isEventFollowed}
            onToggleFollow={handleToggleFollow}
            onViewMap={handleViewEventsMap}
            onViewEvent={(eventId) => {
              setScannedEventId(eventId);
              setCurrentScreen('event-details');
            }}
            onScanQR={() => setCurrentScreen('qr-scanner')}
          />
        );

      case 'leaderboard':
        return <Leaderboard />;

      case 'qr-scanner':
        return (
          <QRScanner
            onClose={() => {
              const previousTab = activeTab === 'home' ? 'home' : 'turni';
              handleTabChange(previousTab);
            }}
            onScan={handleQRScanAttempt}
          />
        );

      case 'event-confirmation': {
        const selectedRole = roles.find((role) => role.id === state.profile.roleId);
        return (
          <EventConfirmation
            event={selectedEvent}
            role={selectedRole}
            onConfirm={handleEventConfirm}
            onCancel={() => setCurrentScreen('turni')}
          />
        );
      }

      case 'event-details':
        return (
          <EventDetails
            event={selectedEvent}
            onBack={() => setCurrentScreen('home')}
            onNavigate={() => handleNavigateToEvent(selectedEvent)}
          />
        );

      case 'attivita':
        return <Attivita activities={activities} onStartActivity={handleStartActivity} />;

      case 'activity-detail':
        return (
          currentActivity && (
            <ActivityDetail
              activity={currentActivity}
              onStart={handleActivityStart}
              onClose={() => setCurrentScreen('attivita')}
            />
          )
        );

      case 'profilo':
        return (
          <Profilo
            userName={state.profile.name}
            userRole={roles.find((role) => role.id === state.profile.roleId)?.name ?? 'Ruolo'}
            level={state.profile.level}
            xp={state.profile.xp}
            xpTotal={state.profile.xpTotal}
            xpSulCampo={state.profile.xpField}
            reputationGlobal={state.profile.reputation}
            theatreReputation={theatreReputationForProfile}
            theatreReputationLoading={theatreReputationLoading}
            badgesUnlockedCount={unlockedBadges.length}
            newBadgesCount={newBadges.length}
            profileImage={state.profile.profileImage}
            onViewCarriera={handleViewCarriera}
            onViewTitoli={handleViewTitoli}
            onSettings={handleViewAccountSettings}
            onLogout={handleLogout}
            onUploadProfileImage={handleUploadProfileImage}
          />
        );

      case 'account-settings':
        return (
          <AccountSettings
            userName={state.profile.name}
            email={state.profile.email}
            onBack={() => setCurrentScreen('profilo')}
            onViewTerms={() => openTerms('account-settings')}
            onViewPrivacy={() => openPrivacy('account-settings')}
            onChangePassword={() => {
              setIsPasswordRecovery(false);
              setCurrentScreen('change-password');
            }}
            onResetProgress={handleResetProgress}
            onLogout={handleLogout}
          />
        );

      case 'change-password':
        return (
          <ChangePassword
            email={state.profile.email}
            mode={isPasswordRecovery ? 'recovery' : 'change'}
            onBack={handleCloseChangePassword}
            onChangePassword={(currentPassword, newPassword) => changePassword(newPassword, currentPassword)}
            onSendResetEmail={() => sendPasswordResetEmail(state.profile.email)}
          />
        );

      case 'carriera': {
        const selectedRole = roles.find((role) => role.id === state.profile.roleId);
        const fallbackRoleStats = { presence: 0, precision: 0, leadership: 0, creativity: 0 };
        return (
          <Carriera
            userRole={selectedRole?.name ?? 'Ruolo'}
            roleId={state.profile.roleId}
            roleStats={selectedRole?.stats ?? fallbackRoleStats}
            turnStats={turnStats}
            badges={badges}
            turns={state.turns}
            roles={roles}
            level={state.profile.level}
            xp={state.profile.xp}
            xpToNextLevel={state.profile.xpToNextLevel}
            xpTotal={state.profile.xpTotal}
            xpSulCampo={state.profile.xpField}
            reputationGlobal={state.profile.reputation}
            onBack={() => setCurrentScreen('profilo')}
          />
        );
      }

      case 'terms':
        return <TermsAndConditions onBack={() => setCurrentScreen(legalReturnScreen)} />;

      case 'privacy':
        return <PrivacyPolicy onBack={() => setCurrentScreen(legalReturnScreen)} />;

      case 'titoli-ottenuti':
        return (
          <TitoliOttenuti
            badges={unlockedBadges}
            onBack={() => setCurrentScreen('profilo')}
            onViewed={markBadgesSeen}
          />
        );

      default:
        return null;
    }
  };

  const showBottomNav = ['home', 'turni', 'leaderboard', 'attivita', 'profilo', 'carriera', 'titoli-ottenuti'].includes(currentScreen);

  return (
    <div className="min-h-screen app-gradient app-shell">
      <div className="app-frame">{renderScreen()}</div>
      {showBottomNav && <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />}
    </div>
  );
}

export default function App() {
  return (
    <GameStateProvider>
      <AppShell />
    </GameStateProvider>
  );
}
