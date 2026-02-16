import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { BottomNav } from './components/BottomNav';
import { Welcome } from './components/screens/Welcome';
import { Login } from './components/screens/Login';
import { Signup } from './components/screens/Signup';
import { RoleSelection } from './components/screens/RoleSelection';
import { Home } from './components/screens/Home';
import { ATCLTurns } from './components/screens/ATCLTurns';
import { QRScanner } from './components/screens/QRScanner';
import { EventConfirmation } from './components/screens/EventConfirmation';
import { EventDetails } from './components/screens/EventDetails';
import { Activities } from './components/screens/Activities';
import { ActivityDetail } from './components/screens/ActivityDetail';
import { ActivityMinigame } from './components/screens/ActivityMinigame';
import { ActivityResult } from './components/screens/ActivityResult';
import { Leaderboard } from './components/screens/Leaderboard';
import { Profile } from './components/screens/Profile';
import { AccountSettings } from './components/screens/AccountSettings';
import { SupportChat } from './components/screens/SupportChat';
import { ChangePassword } from './components/screens/ChangePassword';
import { Career } from './components/screens/Career';
import { InstallApp } from './components/screens/InstallApp';
import { TermsAndConditions } from './components/screens/TermsAndConditions';
import { PrivacyPolicy } from './components/screens/PrivacyPolicy';
import { EarnedTitles } from './components/screens/EarnedTitles';
import { TicketQrActivationPrototype } from './components/screens/TicketQrActivationPrototype';
import { Activity, GameEvent, GameStateProvider, Rewards, useGameState } from './state/store';
import { isSupabaseConfigured } from './lib/supabase';
import { hasStoredAuthState, PUBLIC_SCREENS } from './lib/auth-storage';
import { openInMaps, openEventsMap } from './lib/navigation-utils';
import { uploadProfileImage } from './services/storage';
import {
  activateTicketByDetails,
  activateTicketHash,
  isManualTicketActivatedInSession,
  isTicketHashActivatedInSession,
  parseTicketQrValue,
  resolveTicketHashPreview,
  type ActivatedEventPayload,
} from './services/ticket-activation';
import { ScreenTransition } from './components/ui/ScreenTransition';
import { ErrorOverlay } from './components/ui/ErrorOverlay';
import { initErrorHandler, subscribeToCriticalErrors, getLastCriticalError, clearLastCriticalError } from './services/error-handler';
import { MinigameOutcome } from './gameplay/minigames';

// Types and Hooks
import { LegalReturnScreen } from './types/navigation';
import { useNavigation } from './hooks/useNavigation';
import { useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import { useQrLanding } from './hooks/useQrLanding';
import { PENDING_EVENT_KEY, readPendingEventFromUrl, stripEventLinkParams } from './lib/event-linking';
import { validateQrPayload } from './services/event-links';
import { isNativeIOSApp } from './lib/native-platform';

function AppShell() {
  const {
    authUserId, authReady, hasHydratedRemote, state, roles, events,
    activities, turnStats, statsLoading, theatreReputation,
    theatreReputationLoading, badges, followedEvents, followedEventsLoading,
    followEvent, unfollowEvent, isEventFollowed, markBadgesSeen,
    updateProfile, registerTurn, completeActivity, resetProgress, resetState,
    changePassword, sendPasswordResetEmail
  } = useGameState();

  // Navigation Hook
  const {
    currentScreen, setCurrentScreen, activeTab, setActiveTab, handleTabChange,
    legalReturnScreen, setLegalReturnScreen, isPasswordRecovery, setIsPasswordRecovery,
    scannedEventId, setScannedEventId, selectedActivityId, setSelectedActivityId,
  } = useNavigation(events);

  const [activityOutcome, setActivityOutcome] = useState<MinigameOutcome | null>(null);
  const [activityCompletion, setActivityCompletion] = useState<{ activity: Activity; rewards: Rewards } | null>(null);

  // Animation state for tab transitions
  const [screenAnimation, setScreenAnimation] = useState('');
  const [screenAnimationKey, setScreenAnimationKey] = useState(0);
  const previousTabRef = useRef(activeTab);
  const [criticalError, setCriticalError] = useState<{ title?: string; message?: string; details?: string } | null>(null);
  type PendingTicketActivation =
    | { mode: 'hash'; hash: string; eventId: string; event?: ActivatedEventPayload }
    | { mode: 'manual'; eventId: string; ticketNumber: string };
  const [pendingTicketActivation, setPendingTicketActivation] = useState<PendingTicketActivation | null>(null);
  const [confirmationEventOverride, setConfirmationEventOverride] = useState<GameEvent | null>(null);
  const iosNativeUI = useMemo(() => isNativeIOSApp(), []);

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
      setAuthError(null);
      setIsPasswordRecovery(false);
      setLegalReturnScreen('welcome');
      setSelectedActivityId('');
      setScannedEventId('');
      setActiveTab('home');
      setActivityOutcome(null);
      setActivityCompletion(null);
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      resetState();
      setCurrentScreen('welcome');
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

  useEffect(() => {
    initErrorHandler();
    const pending = getLastCriticalError();
    if (pending) {
      setCriticalError(pending);
    }
    return subscribeToCriticalErrors((payload) => {
      setCriticalError((prev) => prev ?? payload);
    });
  }, []);

  useEffect(() => {
    const classNames = ['platform-ios-native', 'ios26-ui'];
    const root = document.documentElement;
    const body = document.body;

    classNames.forEach((className) => {
      root.classList.toggle(className, iosNativeUI);
      body.classList.toggle(className, iosNativeUI);
    });

    return () => {
      classNames.forEach((className) => {
        root.classList.remove(className);
        body.classList.remove(className);
      });
    };
  }, [iosNativeUI]);

  useEffect(() => {
    if (!criticalError) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [criticalError]);

  // Tab transition animation logic
  useEffect(() => {
    if (activeTab === previousTabRef.current) return;

    // Determine animation based on tab order
    const tabOrder = ['home', 'turns', 'leaderboard', 'activities', 'profile'];
    const currentIndex = tabOrder.indexOf(activeTab);
    const previousIndex = tabOrder.indexOf(previousTabRef.current);

    let animation = '';
    if (currentIndex === -1 || previousIndex === -1) {
      animation = 'tab-fade-in';
    } else if (currentIndex > previousIndex) {
      // Moving right in tab order
      if (activeTab === 'activities') animation = 'tab-slide-up';
      else if (activeTab === 'profile') animation = 'tab-slide-up';
      else animation = 'tab-slide-right';
    } else {
      // Moving left in tab order
      if (previousTabRef.current === 'activities' || previousTabRef.current === 'profile') animation = 'tab-slide-down';
      else animation = 'tab-slide-left';
    }

    setScreenAnimation(animation);
    setScreenAnimationKey((value) => value + 1);
    previousTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (PUBLIC_SCREENS.has(currentScreen)) return;

    if (isSupabaseConfigured) {
      if (!authReady) return;
      if (authUserId) return;
      if (hasStoredAuthState()) return;
    } else {
      if (hasValidEmail) return;
      if (hasStoredAuthState()) return;
    }

    setAuthError(null);
    setIsPasswordRecovery(false);
    setLegalReturnScreen('welcome');
    setSelectedActivityId('');
    setScannedEventId('');
    setActiveTab('home');
    resetState();
    setCurrentScreen('welcome');
  }, [
    authReady,
    authUserId,
    currentScreen,
    hasValidEmail,
    resetState,
    setActiveTab,
    setAuthError,
    setCurrentScreen,
    setIsPasswordRecovery,
    setLegalReturnScreen,
    setScannedEventId,
    setSelectedActivityId,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pendingFromUrl = readPendingEventFromUrl(window.location.href);
    if (!pendingFromUrl?.eventId) return;

    window.sessionStorage.setItem(PENDING_EVENT_KEY, pendingFromUrl.eventId);

    try {
      window.history.replaceState({}, '', stripEventLinkParams(window.location.href));
    } catch {
      // ignore
    }

    if (authReady && isAuthValid) {
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(pendingFromUrl.eventId);
      setCurrentScreen('event-confirmation');
      window.sessionStorage.removeItem(PENDING_EVENT_KEY);
    }
  }, [authReady, isAuthValid, setCurrentScreen, setScannedEventId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authReady || !isAuthValid) return;

    const pendingEventId = window.sessionStorage.getItem(PENDING_EVENT_KEY);
    if (!pendingEventId) return;

    setPendingTicketActivation(null);
    setConfirmationEventOverride(null);
    setScannedEventId(pendingEventId);
    setCurrentScreen('event-confirmation');
    window.sessionStorage.removeItem(PENDING_EVENT_KEY);
  }, [authReady, isAuthValid, setCurrentScreen, setScannedEventId]);

  // Handler Actions
  const mapActivatedEvent = (eventId: string, eventPayload?: ActivatedEventPayload): GameEvent | undefined => {
    const existingEvent = events.find((event) => event.id === eventId);
    if (existingEvent) return existingEvent;
    if (!eventPayload) return undefined;

    const theatre = String(eventPayload.theatre ?? '').trim();
    const date = String(eventPayload.event_date ?? '').trim();
    const time = String(eventPayload.event_time ?? '').trim();
    if (!theatre || !date || !time) return undefined;

    const toNumber = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const baseRewards = eventPayload.base_rewards ?? {};
    return {
      id: eventId,
      name: String(eventPayload.name ?? eventId).trim() || eventId,
      theatre,
      date,
      time,
      genre: String(eventPayload.genre ?? 'Evento').trim() || 'Evento',
      baseRewards: {
        xp: toNumber(baseRewards.xp),
        reputation: toNumber(baseRewards.reputation),
        cachet: toNumber(baseRewards.cachet),
      },
    };
  };

  const handleQRScanAttempt = async (code: string) => {
    if (!authReady) return { ok: false as const, error: 'Verifica sessione...' };
    if (!isAuthValid) {
      setCurrentScreen('welcome');
      return { ok: false as const, error: 'Login richiesto.' };
    }

    const activationUserId = (authUserId ?? state.profile.email ?? '').trim();

    // 1. Manual Ticket Entry (e.g. from manual-ticket:EVENT_ID:TICKET_NUM)
    if (code.startsWith('manual-ticket:')) {
      const [, eventId, ticketNumber] = code.split(':');
      if (!eventId || !ticketNumber) return { ok: false as const, error: 'Dati manuali incompleti.' };

      const normalizedEventId = eventId.trim();
      const normalizedTicketNumber = ticketNumber.trim();
      if (isManualTicketActivatedInSession(normalizedEventId, normalizedTicketNumber)) {
        return { ok: false as const, error: 'Ticket già attivato in questa sessione.' };
      }
      if (!events.some((event) => event.id === normalizedEventId)) {
        return { ok: false as const, error: 'Evento non presente nel calendario.' };
      }

      setPendingTicketActivation({
        mode: 'manual',
        eventId: normalizedEventId,
        ticketNumber: normalizedTicketNumber,
      });
      setConfirmationEventOverride(mapActivatedEvent(normalizedEventId) ?? null);
      setScannedEventId(normalizedEventId);
      setCurrentScreen('event-confirmation');
      return { ok: true as const };
    }

    // 2. Ticket hash (raw SHA-256) or legacy turni://ticket/...
    const ticketHash = parseTicketQrValue(code);
    if (ticketHash) {
      if (!activationUserId) {
        return { ok: false as const, error: 'Utente non disponibile per l\'attivazione ticket.' };
      }
      if (isTicketHashActivatedInSession(ticketHash)) {
        return { ok: false as const, error: 'Ticket già attivato in questa sessione.' };
      }

      const preview = await resolveTicketHashPreview(ticketHash);
      if (!preview.ok) {
        return { ok: false as const, error: preview.error };
      }

      setPendingTicketActivation({
        mode: 'hash',
        hash: ticketHash,
        eventId: preview.eventId,
        event: preview.event,
      });
      setConfirmationEventOverride(mapActivatedEvent(preview.eventId, preview.event) ?? null);
      setScannedEventId(preview.eventId);
      setCurrentScreen('event-confirmation');
      return { ok: true as const };
    }

    const result = await validateQrPayload(code, events.map((event) => event.id));
    if (!result.valid || !result.eventId) {
      return { ok: false as const, error: result.error ?? 'QR non valido.' };
    }

    setPendingTicketActivation(null);
    setConfirmationEventOverride(null);
    setScannedEventId(result.eventId);
    setCurrentScreen('event-confirmation');
    return { ok: true as const };
  };

  const handleEventConfirm = async () => {
    const activationUserId = (authUserId ?? state.profile.email ?? '').trim();

    if (pendingTicketActivation?.mode === 'hash') {
      if (!activationUserId) {
        window.alert('Sessione non valida. Effettua di nuovo il login.');
        setCurrentScreen('welcome');
        return;
      }

      const activation = await activateTicketHash(pendingTicketActivation.hash, activationUserId);
      if (!activation.ok) {
        window.alert(activation.error);
        return;
      }

      const resolvedEventId = activation.eventId ?? pendingTicketActivation.eventId;
      const turnRecord = registerTurn(
        resolvedEventId,
        state.profile.roleId,
        mapActivatedEvent(resolvedEventId, activation.event ?? pendingTicketActivation.event)
      );
      if (!turnRecord) {
        window.alert('Ticket attivato, ma non e stato possibile registrare il turno.');
        return;
      }

      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(resolvedEventId);
      handleTabChange('home');
      return;
    }

    if (pendingTicketActivation?.mode === 'manual') {
      if (!activationUserId) {
        window.alert('Sessione non valida. Effettua di nuovo il login.');
        setCurrentScreen('welcome');
        return;
      }

      const activation = await activateTicketByDetails(
        pendingTicketActivation.eventId,
        pendingTicketActivation.ticketNumber,
        activationUserId
      );
      if (!activation.ok) {
        window.alert(activation.error);
        return;
      }

      const resolvedEventId = activation.eventId ?? pendingTicketActivation.eventId;
      const turnRecord = registerTurn(
        resolvedEventId,
        state.profile.roleId,
        mapActivatedEvent(resolvedEventId, activation.event)
      );
      if (!turnRecord) {
        window.alert('Ticket attivato, ma non e stato possibile registrare il turno.');
        return;
      }

      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(resolvedEventId);
      handleTabChange('home');
      return;
    }

    if (registerTurn(scannedEventId, state.profile.roleId, confirmationEventOverride ?? undefined)) {
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
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
    const selectedEvent = confirmationEventOverride ?? events.find(e => e.id === scannedEventId);
    const selectedRole = roles.find(r => r.id === state.profile.roleId);
    const currentActivity = activities.find(a => a.id === selectedActivityId);

    switch (currentScreen) {
      case 'welcome': return <Welcome onStart={() => setCurrentScreen('signup')} onLogin={() => setCurrentScreen('login')} />;
      case 'login': return <Login onBack={() => setCurrentScreen('welcome')} onLogin={handleLogin} onSignup={() => setCurrentScreen('signup')} onForgotPassword={() => { }} errorMessage={authError} />;
      case 'signup': return <Signup onBack={() => setCurrentScreen('welcome')} onSignup={handleSignup} onLogin={() => setCurrentScreen('login')} onViewTerms={() => openLegal('terms', 'signup')} onViewPrivacy={() => openLegal('privacy', 'signup')} errorMessage={authError} />;
      case 'install': return (
        <InstallApp
          onContinue={() => setCurrentScreen(state.profile.roleId ? 'home' : 'welcome')}
          onDismiss={() => setCurrentScreen(state.profile.roleId ? 'home' : 'welcome')}
        />
      );
      case 'role-selection': return <RoleSelection roles={roles} onComplete={(role) => { updateProfile({ roleId: role.id as any }); setCurrentScreen('home'); }} />;
      case 'home': return <Home userName={state.profile.name} userRole={selectedRole?.name ?? 'Ruolo'} level={state.profile.level} xp={state.profile.xp} xpToNextLevel={state.profile.xpToNextLevel} reputation={state.profile.reputation} onScanQR={() => setCurrentScreen('qr-scanner')} onViewActivities={() => handleTabChange('activities')} onViewTurni={() => handleTabChange('turns')} onViewEventDetails={() => { setScannedEventId(upcomingEvent?.id ?? ''); setCurrentScreen('event-details'); }} onNavigateToEvent={() => openInMaps(upcomingEvent?.theatre ?? '')} upcomingEvent={upcomingEvent} totalTurns={turnStats.totalTurns} turnsThisMonth={turnStats.turnsThisMonth} uniqueTheatres={turnStats.uniqueTheatres} activitiesCount={activities.length} eventLoading={followedEventsLoading} statsLoading={statsLoading} newBadgesCount={newBadges.length} newBadgeTitle={newestNewBadge?.title} onDismissBadgeNotification={markBadgesSeen} />;
      case 'turns': return <ATCLTurns events={events} isEventFollowed={isEventFollowed} onToggleFollow={(id: string) => isEventFollowed(id) ? unfollowEvent(id) : followEvent(id)} onViewMap={() => openEventsMap(events.map(e => e.theatre))} onViewEvent={(id: string) => { setScannedEventId(id); setCurrentScreen('event-details'); }} onScanQR={() => setCurrentScreen('qr-scanner')} />;
      case 'leaderboard': return <Leaderboard />;
      case 'qr-scanner': return <QRScanner onClose={() => handleTabChange(activeTab === 'home' ? 'home' : 'turns')} onScan={handleQRScanAttempt} events={events} />;
      case 'event-confirmation': return (
        <EventConfirmation
          event={selectedEvent}
          role={selectedRole}
          onConfirm={handleEventConfirm}
          onCancel={() => {
            setPendingTicketActivation(null);
            setConfirmationEventOverride(null);
            setScannedEventId('');
            handleTabChange(activeTab === 'home' ? 'home' : 'turns');
          }}
        />
      );
      case 'event-details': return <EventDetails event={selectedEvent} onBack={() => setCurrentScreen('home')} onNavigate={() => openInMaps(selectedEvent?.theatre ?? '')} />;
      case 'activities': return <Activities activities={activities} onStartActivity={(id: string) => { setSelectedActivityId(id); setCurrentScreen('activity-detail'); }} />;
      case 'activity-detail': return currentActivity && <ActivityDetail activity={currentActivity} onStart={() => { setActivityOutcome(null); setActivityCompletion(null); setCurrentScreen('activity-minigame'); }} onClose={() => setCurrentScreen('activities')} />;
      case 'activity-minigame':
        return currentActivity && (
          <ActivityMinigame
            activity={currentActivity}
            onCancel={() => setCurrentScreen('activity-detail')}
            onComplete={(outcome) => {
              const completion = completeActivity(selectedActivityId);
              if (!completion) {
                handleTabChange('activities');
                return;
              }
              setActivityOutcome(outcome);
              setActivityCompletion(completion);
              setCurrentScreen('activity-result');
            }}
          />
        );
      case 'activity-result':
        return activityCompletion && activityOutcome ? (
          <ActivityResult
            activity={activityCompletion.activity}
            rewards={activityCompletion.rewards}
            outcome={activityOutcome}
            onDone={() => handleTabChange('activities')}
          />
        ) : (
          <Activities activities={activities} onStartActivity={(id: string) => { setSelectedActivityId(id); setCurrentScreen('activity-detail'); }} />
        );
      case 'profile': return <Profile userName={state.profile.name} userRole={selectedRole?.name ?? 'Ruolo'} level={state.profile.level} xp={state.profile.xp} xpTotal={state.profile.xpTotal} xpSulCampo={state.profile.xpField} reputationGlobal={state.profile.reputation} theatreReputation={theatreReputation.map(tr => ({ name: tr.theatre, reputation: tr.reputation }))} theatreReputationLoading={theatreReputationLoading} badgesUnlockedCount={unlockedBadges.length} newBadgesCount={newBadges.length} profileImage={state.profile.profileImage} onViewCarriera={() => setCurrentScreen('career')} onViewTitoli={() => setCurrentScreen('earned-titles')} onSettings={() => setCurrentScreen('account-settings')} onLogout={handleLogout} onUploadProfileImage={handleUploadImage} />;
      case 'account-settings': return <AccountSettings userName={state.profile.name} email={state.profile.email} onBack={() => setCurrentScreen('profile')} onViewTerms={() => openLegal('terms', 'account-settings')} onViewPrivacy={() => openLegal('privacy', 'account-settings')} onViewSupport={() => setCurrentScreen('support')} onViewTicketPrototype={() => setCurrentScreen('ticket-qr-prototype')} onChangePassword={() => { setIsPasswordRecovery(false); setCurrentScreen('change-password'); }} onResetProgress={async () => { await resetProgress(); handleTabChange('home'); setCurrentScreen('role-selection'); }} onLogout={handleLogout} />;
      case 'support': return <SupportChat userName={state.profile.name} onBack={() => setCurrentScreen('account-settings')} />;
      case 'change-password': return <ChangePassword email={state.profile.email} mode={isPasswordRecovery ? 'recovery' : 'change'} onBack={() => { setIsPasswordRecovery(false); setCurrentScreen(isPasswordRecovery ? 'home' : 'account-settings'); }} onChangePassword={(current, next) => changePassword(next, current)} onSendResetEmail={() => sendPasswordResetEmail(state.profile.email)} />;
      case 'career': return <Career userRole={selectedRole?.name ?? 'Ruolo'} roleId={state.profile.roleId} roleStats={selectedRole?.stats ?? { presence: 0, precision: 0, leadership: 0, creativity: 0 }} turnStats={turnStats} badges={badges} turns={state.turns} roles={roles} level={state.profile.level} xp={state.profile.xp} xpToNextLevel={state.profile.xpToNextLevel} xpTotal={state.profile.xpTotal} xpSulCampo={state.profile.xpField} reputationGlobal={state.profile.reputation} onBack={() => setCurrentScreen('profile')} />;
      case 'terms': return <TermsAndConditions onBack={() => setCurrentScreen(legalReturnScreen)} />;
      case 'privacy': return <PrivacyPolicy onBack={() => setCurrentScreen(legalReturnScreen)} />;
      case 'earned-titles': return <EarnedTitles badges={unlockedBadges} onBack={() => setCurrentScreen('profile')} onViewed={markBadgesSeen} />;
      case 'ticket-qr-prototype': return <TicketQrActivationPrototype userId={authUserId ?? state.profile.email ?? 'guest-user'} onBack={() => setCurrentScreen('account-settings')} />;
      default: return null;
    }
  };

  const showBottomNav = ['home', 'turns', 'leaderboard', 'activities', 'profile', 'career', 'earned-titles'].includes(currentScreen);
  const normalizedError = useMemo(() => {
    if (!criticalError) return null;
    return {
      title: criticalError.title ?? 'Problema tecnico',
      message: criticalError.message ?? 'Non riusciamo a caricare i dati in questo momento. Riprova tra poco.',
      details: criticalError.details?.trim() ? criticalError.details : undefined,
    };
  }, [criticalError]);

  return (
    <div className={`min-h-screen app-gradient app-shell ${iosNativeUI ? 'ios26-root' : ''}`}>
      <ScreenTransition animationClass={screenAnimation} animationKey={screenAnimationKey}>
        <div className="app-frame">{renderScreen()}</div>
      </ScreenTransition>
      {showBottomNav && <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />}
      {normalizedError ? (
        <ErrorOverlay
          title={normalizedError.title}
          message={normalizedError.message}
          details={normalizedError.details}
          onReload={() => window.location.reload()}
          onHome={() => {
            clearLastCriticalError();
            setCriticalError(null);
            setActiveTab('home');
            setCurrentScreen('home');
          }}
        />
      ) : null}
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

