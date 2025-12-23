import React, { useMemo, useState } from 'react';
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
import { GameStateProvider, useGameState } from './state/store';


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
  | 'carriera';

type Tab = 'home' | 'turni' | 'attivita' | 'profilo';

function AppShell() {
  const { state, roles, events, activities, updateProfile, registerTurn, completeActivity } = useGameState();
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [scannedEventId, setScannedEventId] = useState<string>(events[0]?.id ?? '');
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');

  const upcomingEvent = useMemo(() => events[0], [events]);

  const handleStart = () => setCurrentScreen('signup');

  const handleLogin = (email: string, password: string) => {
    updateProfile({ email });
    setCurrentScreen('home');
  };

  const handleSignup = (name: string, email: string, password: string) => {
    updateProfile({ name, email });
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

  const handleEventConfirm = (roleId: string) => {
    const resolvedRoleId = (roleId as typeof state.profile.roleId) || state.profile.roleId;
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

  const handleLogout = () => {
    setCurrentScreen('welcome');
    setActiveTab('home');
  };

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
          />
        );

      case 'signup':
        return <Signup onBack={() => setCurrentScreen('welcome')} onSignup={handleSignup} onLogin={() => setCurrentScreen('login')} />;

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
            activitiesCount={activities.length}
          />
        );

      case 'turni':
        return <TurniATCL turns={state.turns} onScanQR={() => setCurrentScreen('qr-scanner')} />;

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

      case 'event-confirmation':
        return (
          <EventConfirmation
            event={selectedEvent}
            roles={roles}
            onConfirm={handleEventConfirm}
            onCancel={() => setCurrentScreen('turni')}
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
            onViewCarriera={handleViewCarriera}
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

      default:
        return null;
    }
  };

  const showBottomNav = ['home', 'turni', 'attivita', 'profilo', 'carriera'].includes(currentScreen);

  return (
    <div className="min-h-screen bg-[#0f0d0e]">
      {renderScreen()}
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
