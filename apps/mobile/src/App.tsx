import React, { useMemo, useCallback } from 'react';
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
import { SupportChat } from './components/screens/SupportChat';
import { ChangePassword } from './components/screens/ChangePassword';
import { Carriera } from './components/screens/Carriera';
import { InstallApp } from './components/screens/InstallApp';
import { TermsAndConditions } from './components/screens/TermsAndConditions';
import { PrivacyPolicy } from './components/screens/PrivacyPolicy';
import { TitoliOttenuti } from './components/screens/TitoliOttenuti';
import { GameStateProvider, useGameState } from './state/store';
import { isSupabaseConfigured } from './lib/supabase';
import { openInMaps, openEventsMap } from './lib/navigation-utils';
import { uploadProfileImage } from './services/storage';

// Types and Hooks
import { Screen, LegalReturnScreen } from './types/navigation';
import { useNavigation } from './hooks/useNavigation';
import { useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import { useQrLanding } from './hooks/useQrLanding';

function AppShell() {
  const {
    authUserId, authReady, hasHydratedRemote, state, roles, events,
    activities, turnStats, statsLoading, theatreReputation,
    theatreReputationLoading, badges, followedEvents, followedEventsLoading,
    followEvent, unfollowEvent, isEventFollowed, markBadgesSeen,
    updateProfile, registerTurn, completeActivity, resetProgress,
    changePassword, sendPasswordResetEmail
  } = useGameState();

  // Navigation Hook
  const {
    currentScreen, setCurrentScreen, activeTab, handleTabChange,
    legalReturnScreen, setLegalReturnScreen, isPasswordRecovery, setIsPasswordRecovery,
    scannedEventId, setScannedEventId, selectedActivityId, setSelectedActivityId,
  } = useNavigation(events);

  // Auth Hook
  const {
    authError, setAuthError, handleLogin, handleSignup, handleLogout
  } = useAuth(
    state.profile,
    updateProfile,
    (screen, isRecovery) => {
      if (isRecovery !== undefined) setIsPasswordRecovery(isRecovery);
      if (screen === 'home') {
        const shouldAutoHome = currentScreen === 'welcome' || currentScreen === 'login';
        if (shouldAutoHome) setCurrentScreen('home');
      } else {
        setCurrentScreen(screen);
      }
    },
    () => {
      setIsPasswordRecovery(false);
      setCurrentScreen('welcome');
      handleTabChange('home');
    }
  );

  // Helpers derived from state
  const upcomingEvent = useMemo(() => followedEvents[0], [followedEvents]);
  const unlockedBadges = useMemo(() => badges.filter(b => b.unlocked), [badges]);
  const newBadges = useMemo(() => unlockedBadges.filter(b => !b.seenAt), [unlockedBadges]);
  const newestNewBadge = useMemo(() => {
    if (!newBadges.length) return null;
    return [...newBadges].sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))[0];
  }, [newBadges]);

  const hasValidEmail = Boolean(state.profile.email && state.profile.email.includes('@'));
  const isAuthValid = useMemo(() => {
    if (!isSupabaseConfigured) return true;
    if (!authReady) return false;
    return Boolean(authUserId && hasHydratedRemote && hasValidEmail);
  }, [authReady, authUserId, hasHydratedRemote, hasValidEmail]);

  // Notification and QR Landing Hooks
  useNotifications(upcomingEvent, newestNewBadge ?? undefined);
  useQrLanding(authReady, isAuthValid, (target) => setCurrentScreen(target));

  // Handler Actions
  const handleQRScanAttempt = (code: string) => {
    if (!authReady) return { ok: false as const, error: 'Verifica sessione...' };
    if (!isAuthValid) { setCurrentScreen('welcome'); return { ok: false as const, error: 'Login richiesto.' }; }
    const resolved = events.find(e => code.toLowerCase().includes(e.id.toLowerCase()));
    if (!resolved) return { ok: false as const, error: 'QR non valido.' };
    setScannedEventId(resolved.id);
    setCurrentScreen('event-confirmation');
    return { ok: true as const };
  };

  const handleEventConfirm = () => {
    if (registerTurn(scannedEventId, state.profile.roleId)) {
      handleTabChange('home');
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!authUserId) return;
    const url = await uploadProfileImage(authUserId, file);
    updateProfile({ profileImage: url });
  };

  const openLegal = (screen: 'terms' | 'privacy', from: LegalReturnScreen) => {
    setLegalReturnScreen(from);
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    const selectedEvent = events.find(e => e.id === scannedEventId);
    const selectedRole = roles.find(r => r.id === state.profile.roleId);
    const currentActivity = activities.find(a => a.id === selectedActivityId);

    switch (currentScreen) {
      case 'welcome': return <Welcome onStart={() => setCurrentScreen('signup')} onLogin={() => setCurrentScreen('login')} />;
      case 'login': return <Login onBack={() => setCurrentScreen('welcome')} onLogin={handleLogin} onSignup={() => setCurrentScreen('signup')} onForgotPassword={() => { }} errorMessage={authError} />;
      case 'signup': return <Signup onBack={() => setCurrentScreen('welcome')} onSignup={handleSignup} onLogin={() => setCurrentScreen('login')} onViewTerms={() => openLegal('terms', 'signup')} onViewPrivacy={() => openLegal('privacy', 'signup')} errorMessage={authError} />;
      case 'install': return <InstallApp onContinue={() => setCurrentScreen(state.profile.roleId ? 'home' : 'welcome')} />;
      case 'role-selection': return <RoleSelection roles={roles} onComplete={(role) => { updateProfile({ roleId: role.id as any }); setCurrentScreen('home'); }} />;
      case 'home': return <Home userName={state.profile.name} userRole={selectedRole?.name ?? 'Ruolo'} level={state.profile.level} xp={state.profile.xp} xpToNextLevel={state.profile.xpToNextLevel} reputation={state.profile.reputation} onScanQR={() => setCurrentScreen('qr-scanner')} onViewActivities={() => handleTabChange('attivita')} onViewTurni={() => handleTabChange('turni')} onViewEventDetails={() => { setScannedEventId(upcomingEvent?.id ?? ''); setCurrentScreen('event-details'); }} onNavigateToEvent={() => openInMaps(upcomingEvent?.theatre ?? '')} upcomingEvent={upcomingEvent} totalTurns={turnStats.totalTurns} turnsThisMonth={turnStats.turnsThisMonth} uniqueTheatres={turnStats.uniqueTheatres} activitiesCount={activities.length} eventLoading={followedEventsLoading} statsLoading={statsLoading} newBadgesCount={newBadges.length} newBadgeTitle={newestNewBadge?.title} onDismissBadgeNotification={markBadgesSeen} />;
      case 'turni': return <TurniATCL events={events} isEventFollowed={isEventFollowed} onToggleFollow={(id) => isEventFollowed(id) ? unfollowEvent(id) : followEvent(id)} onViewMap={() => openEventsMap(events.map(e => e.theatre))} onViewEvent={(id) => { setScannedEventId(id); setCurrentScreen('event-details'); }} onScanQR={() => setCurrentScreen('qr-scanner')} />;
      case 'leaderboard': return <Leaderboard />;
      case 'qr-scanner': return <QRScanner onClose={() => handleTabChange(activeTab === 'home' ? 'home' : 'turni')} onScan={handleQRScanAttempt} />;
      case 'event-confirmation': return <EventConfirmation event={selectedEvent} role={selectedRole} onConfirm={handleEventConfirm} onCancel={() => setCurrentScreen('turni')} />;
      case 'event-details': return <EventDetails event={selectedEvent} onBack={() => setCurrentScreen('home')} onNavigate={() => openInMaps(selectedEvent?.theatre ?? '')} />;
      case 'attivita': return <Attivita activities={activities} onStartActivity={(id) => { setSelectedActivityId(id); setCurrentScreen('activity-detail'); }} />;
      case 'activity-detail': return currentActivity && <ActivityDetail activity={currentActivity} onStart={() => { completeActivity(selectedActivityId); handleTabChange('attivita'); }} onClose={() => setCurrentScreen('attivita')} />;
      case 'profilo': return <Profilo userName={state.profile.name} userRole={selectedRole?.name ?? 'Ruolo'} level={state.profile.level} xp={state.profile.xp} xpTotal={state.profile.xpTotal} xpSulCampo={state.profile.xpField} reputationGlobal={state.profile.reputation} theatreReputation={theatreReputation.map(tr => ({ name: tr.theatre, reputation: tr.reputation }))} theatreReputationLoading={theatreReputationLoading} badgesUnlockedCount={unlockedBadges.length} newBadgesCount={newBadges.length} profileImage={state.profile.profileImage} onViewCarriera={() => setCurrentScreen('carriera')} onViewTitoli={() => setCurrentScreen('titoli-ottenuti')} onSettings={() => setCurrentScreen('account-settings')} onLogout={handleLogout} onUploadProfileImage={handleUploadImage} />;
      case 'account-settings': return <AccountSettings userName={state.profile.name} email={state.profile.email} onBack={() => setCurrentScreen('profilo')} onViewTerms={() => openLegal('terms', 'account-settings')} onViewPrivacy={() => openLegal('privacy', 'account-settings')} onViewSupport={() => setCurrentScreen('support')} onChangePassword={() => { setIsPasswordRecovery(false); setCurrentScreen('change-password'); }} onResetProgress={async () => { await resetProgress(); handleTabChange('home'); setCurrentScreen('role-selection'); }} onLogout={handleLogout} />;
      case 'support': return <SupportChat userName={state.profile.name} onBack={() => setCurrentScreen('account-settings')} />;
      case 'change-password': return <ChangePassword email={state.profile.email} mode={isPasswordRecovery ? 'recovery' : 'change'} onBack={() => { setIsPasswordRecovery(false); setCurrentScreen(isPasswordRecovery ? 'home' : 'account-settings'); }} onChangePassword={(current, next) => changePassword(next, current)} onSendResetEmail={() => sendPasswordResetEmail(state.profile.email)} />;
      case 'carriera': return <Carriera userRole={selectedRole?.name ?? 'Ruolo'} roleId={state.profile.roleId} roleStats={selectedRole?.stats ?? { presence: 0, precision: 0, leadership: 0, creativity: 0 }} turnStats={turnStats} badges={badges} turns={state.turns} roles={roles} level={state.profile.level} xp={state.profile.xp} xpToNextLevel={state.profile.xpToNextLevel} xpTotal={state.profile.xpTotal} xpSulCampo={state.profile.xpField} reputationGlobal={state.profile.reputation} onBack={() => setCurrentScreen('profilo')} />;
      case 'terms': return <TermsAndConditions onBack={() => setCurrentScreen(legalReturnScreen)} />;
      case 'privacy': return <PrivacyPolicy onBack={() => setCurrentScreen(legalReturnScreen)} />;
      case 'titoli-ottenuti': return <TitoliOttenuti badges={unlockedBadges} onBack={() => setCurrentScreen('profilo')} onViewed={markBadgesSeen} />;
      default: return null;
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
