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
import { Carriera } from './components/screens/Carriera';
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
  | 'carriera'
  | 'titoli-ottenuti';

type Tab = 'home' | 'turni' | 'attivita' | 'profilo';

function AppShell() {
  const { state, roles, events, activities, updateProfile, registerTurn, completeActivity } = useGameState();
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [scannedEventId, setScannedEventId] = useState<string>(events[0]?.id ?? '');
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const currentScreenRef = useRef(currentScreen);

  const upcomingEvent = useMemo(() => events[0], [events]);
  const turnStats = useMemo(() => {
    const turns = state.turns;
    if (!turns.length) {
      return { turnsThisMonth: 0, uniqueTheatres: 0 };
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const turnsThisMonth = turns.filter((turn) => {
      const created = new Date(turn.createdAt);
      return created.getFullYear() === year && created.getMonth() === month;
    }).length;
    const uniqueTheatres = new Set(turns.map((turn) => turn.theatre).filter(Boolean)).size;
    return { turnsThisMonth, uniqueTheatres };
  }, [state.turns]);

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

  const handleLogout = () => {
    if (supabase) {
      supabase.auth.signOut();
    }
    setCurrentScreen('welcome');
    setActiveTab('home');
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
            totalTurns={state.turns.length}
            turnsThisMonth={turnStats.turnsThisMonth}
            uniqueTheatres={turnStats.uniqueTheatres}
            activitiesCount={activities.length}
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
            onViewCarriera={handleViewCarriera}
            onViewTitoli={handleViewTitoli}
            onSettings={() => undefined}
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

      case 'titoli-ottenuti':
        return <TitoliOttenuti onBack={() => setCurrentScreen('profilo')} />;

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
