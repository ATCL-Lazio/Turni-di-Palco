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
import { Attivita } from './components/screens/Attivita';
import { ActivityDetail } from './components/screens/ActivityDetail';
import { Profilo } from './components/screens/Profilo';
import { AccountSettings } from './components/screens/AccountSettings';
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
  | 'qr-scanner'
  | 'event-confirmation'
  | 'attivita'
  | 'activity-detail'
  | 'profilo'
  | 'account-settings'
  | 'carriera'
  | 'terms'
  | 'privacy'
  | 'titoli-ottenuti';

type Tab = 'home' | 'turni' | 'attivita' | 'profilo';

type LegalReturnScreen = Exclude<Screen, 'terms' | 'privacy'>;

function AppShell() {
  const {
    state,
    roles,
    events,
    activities,
    turnStats,
    statsLoading,
    theatreReputation,
    theatreReputationLoading,
    badges,
    markBadgesSeen,
    updateProfile,
    registerTurn,
    completeActivity,
    resetProgress,
  } = useGameState();
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [legalReturnScreen, setLegalReturnScreen] = useState<LegalReturnScreen>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [scannedEventId, setScannedEventId] = useState<string>(events[0]?.id ?? '');
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const currentScreenRef = useRef(currentScreen);

  const upcomingEvent = useMemo(() => events[0], [events]);
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
    if (!events.length) return;
    if (!scannedEventId || !events.some((event) => event.id === scannedEventId)) {
      setScannedEventId(events[0].id);
    }
  }, [events, scannedEventId]);

  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

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
      case 'attivita':
        setCurrentScreen('attivita');
        break;
      case 'profilo':
        setCurrentScreen('profilo');
        break;
    }
  };

  const handleQRScanSuccess = (code: string) => {
    const resolved = events.find((event) => code.toLowerCase().includes(event.id.toLowerCase())) ?? events[0];
    if (resolved) {
      setScannedEventId(resolved.id);
    }
    setCurrentScreen('event-confirmation');
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
    setCurrentScreen('welcome');
    setActiveTab('home');
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
        setCurrentScreen('home');
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setCurrentScreen('welcome');
        setActiveTab('home');
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

  const selectedEvent = events.find((event) => event.id === scannedEventId) ?? events[0];
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
            upcomingEvent={upcomingEvent}
            totalTurns={turnStats.totalTurns}
            turnsThisMonth={turnStats.turnsThisMonth}
            uniqueTheatres={turnStats.uniqueTheatres}
            activitiesCount={activities.length}
            statsLoading={statsLoading}
            newBadgesCount={newBadges.length}
            newBadgeTitle={newestNewBadge?.title ?? undefined}
            onDismissBadgeNotification={markBadgesSeen}
          />
        );

      case 'turni':
        return (
          <TurniATCL
            turns={state.turns}
            roles={roles}
            onScanQR={() => setCurrentScreen('qr-scanner')}
          />
        );

      case 'qr-scanner':
        return (
          <QRScanner
            onClose={() => {
              const previousTab = activeTab === 'home' ? 'home' : 'turni';
              handleTabChange(previousTab);
            }}
            onScanSuccess={handleQRScanSuccess}
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
            onViewCarriera={handleViewCarriera}
            onViewTitoli={handleViewTitoli}
            onSettings={handleViewAccountSettings}
            onLogout={handleLogout}
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
            onResetProgress={handleResetProgress}
            onLogout={handleLogout}
          />
        );

      case 'carriera':
        return (
          <Carriera
            userName={state.profile.name}
            userRole={roles.find((role) => role.id === state.profile.roleId)?.name ?? 'Ruolo'}
            level={state.profile.level}
            xp={state.profile.xp}
            xpToNextLevel={state.profile.xpToNextLevel}
            xpTotal={state.profile.xpTotal}
            xpSulCampo={state.profile.xpField}
            reputationGlobal={state.profile.reputation}
            onBack={() => setCurrentScreen('profilo')}
          />
        );

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

  const showBottomNav = ['home', 'turni', 'attivita', 'profilo', 'carriera', 'titoli-ottenuti'].includes(currentScreen);

  return (
    <div className="min-h-screen app-gradient flex items-start justify-center">
      <div className="w-full">
        <div className="w-full max-w-[393px] relative mx-auto min-h-screen">{renderScreen()}</div>
      </div>
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
