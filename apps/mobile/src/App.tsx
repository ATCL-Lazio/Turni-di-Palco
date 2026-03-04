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
import { ActivitiesHub, type ActivitiesHubSection } from './components/screens/ActivitiesHub';
import { ActivityDetail } from './components/screens/ActivityDetail';
import { ActivityMinigame } from './components/screens/ActivityMinigame';
import { ActivityResult } from './components/screens/ActivityResult';
import { Shop } from './components/screens/Shop';
import { Leaderboard } from './components/screens/Leaderboard';
import { Profile } from './components/screens/Profile';
import { PublicProfile } from './components/screens/PublicProfile';
import { AccountSettings } from './components/screens/AccountSettings';
import { SupportChat } from './components/screens/SupportChat';
import { ChangePassword } from './components/screens/ChangePassword';
import { Career } from './components/screens/Career';
import { InstallApp } from './components/screens/InstallApp';
import { TermsAndConditions } from './components/screens/TermsAndConditions';
import { PrivacyPolicy } from './components/screens/PrivacyPolicy';
import { EarnedTitles } from './components/screens/EarnedTitles';
import { TicketQrActivationPrototype } from './components/screens/TicketQrActivationPrototype';
import { Card } from './components/ui/Card';
import { Activity, GameEvent, GameStateProvider, LeaderboardEntry, Rewards, useGameState } from './state/store';
import { isSupabaseConfigured, supabase } from './lib/supabase';
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
import { LegalReturnScreen, Screen, Tab } from './types/navigation';
import { useNavigation } from './hooks/useNavigation';
import { useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import { useQrLanding } from './hooks/useQrLanding';
import { PENDING_EVENT_KEY, readPendingEventFromUrl, stripEventLinkParams } from './lib/event-linking';
import { validateQrPayload } from './services/event-links';

function AppShell() {
  const {
    authUserId, authReady, hasHydratedRemote, state, roles, events,
    activities, turnStats, statsLoading, theatreReputation,
    theatreReputationLoading, badges, followedEvents, followedEventsLoading,
    shopCatalog, shopCatalogLoading, purchaseShopItem,
    activitySlotsStatus, activitySlotsLoading,
    followEvent, unfollowEvent, isEventFollowed, markBadgesSeen,
    updateProfile, registerTurn, pendingBoostRequests, turnSyncFeedback, clearTurnSyncFeedback,
    completeActivity, resetProgress, resetState,
    changePassword, sendPasswordResetEmail, featureFlags, isFeatureEnabled
  } = useGameState();

  const tabFeatureFlags = useMemo(
    () => ({
      turns: featureFlags['mobile.section.turns'],
      leaderboard: featureFlags['mobile.section.leaderboard'],
      activities: featureFlags['mobile.section.activities'],
      shop: featureFlags['mobile.section.shop'],
      career: featureFlags['mobile.section.career'],
      earnedTitles: featureFlags['mobile.section.earned_titles'],
    }),
    [featureFlags]
  );

  const isTabEnabled = useCallback(
    (tab: Tab) => {
      if (tab === 'home' || tab === 'profile') return true;
      if (tab === 'turns' || tab === 'activities') return tabFeatureFlags.turns || tabFeatureFlags.activities;
      if (tab === 'leaderboard') return tabFeatureFlags.leaderboard;
      if (tab === 'shop') return tabFeatureFlags.shop;
      return false;
    },
    [tabFeatureFlags]
  );

  const isScreenEnabled = useCallback(
    (screen: Screen) => {
      if (screen === 'turns' || screen === 'activities') return tabFeatureFlags.turns || tabFeatureFlags.activities;
      if (screen === 'leaderboard') return tabFeatureFlags.leaderboard;
      if (screen === 'activity-detail' || screen === 'activity-minigame' || screen === 'activity-result') {
        return tabFeatureFlags.activities;
      }
      if (screen === 'event-details') return tabFeatureFlags.turns;
      if (screen === 'shop') return tabFeatureFlags.shop;
      if (screen === 'career') return tabFeatureFlags.career;
      if (screen === 'earned-titles') return tabFeatureFlags.earnedTitles;
      if (screen === 'support') return isFeatureEnabled('mobile.action.ai_support');
      if (screen === 'qr-scanner') return isFeatureEnabled('mobile.action.qr_scan');
      if (screen === 'event-confirmation') return isFeatureEnabled('mobile.action.turn_submit');
      if (screen === 'ticket-qr-prototype') return isFeatureEnabled('mobile.dev.ticket_qr_prototype');
      return true;
    },
    [isFeatureEnabled, tabFeatureFlags]
  );

  const showFeatureDisabledAlert = useCallback((label: string) => {
    window.alert(`${label} temporaneamente disattivata.`);
  }, []);

  // Navigation Hook
  const {
    currentScreen, setCurrentScreen, activeTab, setActiveTab, handleTabChange: baseHandleTabChange,
    legalReturnScreen, setLegalReturnScreen, isPasswordRecovery, setIsPasswordRecovery,
    scannedEventId, setScannedEventId, selectedActivityId, setSelectedActivityId,
  } = useNavigation(events, {
    isScreenEnabled,
    isTabEnabled,
  });

  const handleTabChange = useCallback(
    (tab: Tab) => {
      if (tab === 'turns') {
        if (!tabFeatureFlags.turns) {
          showFeatureDisabledAlert('La sezione turni');
          baseHandleTabChange('home');
          return;
        }
        setActivitiesSection('turns');
        baseHandleTabChange('activities');
        return;
      }

      if (tab === 'activities') {
        if (!(tabFeatureFlags.turns || tabFeatureFlags.activities)) {
          showFeatureDisabledAlert('La sezione attivita');
          baseHandleTabChange('home');
          return;
        }
        if (!tabFeatureFlags.activities && tabFeatureFlags.turns) {
          setActivitiesSection('turns');
        } else if (tabFeatureFlags.activities) {
          setActivitiesSection('activities');
        }
        baseHandleTabChange('activities');
        return;
      }

      if (!isTabEnabled(tab)) {
        showFeatureDisabledAlert(`La sezione ${tab}`);
        baseHandleTabChange('home');
        return;
      }
      baseHandleTabChange(tab);
    },
    [baseHandleTabChange, isTabEnabled, showFeatureDisabledAlert, tabFeatureFlags.activities, tabFeatureFlags.turns]
  );

  const [activityOutcome, setActivityOutcome] = useState<MinigameOutcome | null>(null);
  const [activityCompletion, setActivityCompletion] = useState<{ activity: Activity; rewards: Rewards } | null>(null);
  const [activitiesSection, setActivitiesSection] = useState<ActivitiesHubSection>('activities');
  const [selectedLeaderboardEntry, setSelectedLeaderboardEntry] = useState<LeaderboardEntry | null>(null);
  const [publicProfileTheatres, setPublicProfileTheatres] = useState<Array<{ theatre: string; turnsCount: number }>>([]);
  const [publicProfileTheatresLoading, setPublicProfileTheatresLoading] = useState(false);

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
      setSelectedLeaderboardEntry(null);
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
  const canViewAiSupport = isFeatureEnabled('mobile.action.ai_support');
  const canViewTicketQrPrototype = isFeatureEnabled('mobile.dev.ticket_qr_prototype');

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
    const tabOrder = ['home', 'leaderboard', 'activities', 'shop', 'profile'];
    const currentIndex = tabOrder.indexOf(activeTab);
    const previousIndex = tabOrder.indexOf(previousTabRef.current);

    let animation: string;
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
    if (activeTab !== 'turns') return;
    setActivitiesSection('turns');
    baseHandleTabChange('activities');
  }, [activeTab, baseHandleTabChange]);

  useEffect(() => {
    if (!selectedLeaderboardEntry || !supabase) {
      setPublicProfileTheatres([]);
      setPublicProfileTheatresLoading(false);
      return;
    }

    let cancelled = false;

    type PublicProfileTheatreRow = {
      theatre: string | null;
      turns_count: number | null;
    };

    const loadPublicProfileTheatres = async () => {
      setPublicProfileTheatresLoading(true);

      try {
        const { data, error } = await supabase.rpc('get_public_profile_theatres', {
          p_user_id: selectedLeaderboardEntry.id,
        });
        if (error) throw error;

        if (cancelled) return;

        const rows = (data as PublicProfileTheatreRow[]) ?? [];
        setPublicProfileTheatres(
          rows
            .filter((row) => Boolean(row.theatre))
            .map((row) => ({
              theatre: row.theatre ?? 'Teatro',
              turnsCount: row.turns_count ?? 0,
            }))
        );
      } catch (error) {
        console.warn('Supabase public profile theatres fetch failed', error);
        if (!cancelled) {
          setPublicProfileTheatres([]);
        }
      } finally {
        if (!cancelled) {
          setPublicProfileTheatresLoading(false);
        }
      }
    };

    void loadPublicProfileTheatres();

    return () => {
      cancelled = true;
    };
  }, [selectedLeaderboardEntry]);

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
      if (!isFeatureEnabled('mobile.action.turn_submit')) {
        window.sessionStorage.removeItem(PENDING_EVENT_KEY);
        return;
      }
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(pendingFromUrl.eventId);
      setCurrentScreen('event-confirmation');
      window.sessionStorage.removeItem(PENDING_EVENT_KEY);
    }
  }, [authReady, isAuthValid, isFeatureEnabled, setCurrentScreen, setScannedEventId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authReady || !isAuthValid) return;

    const pendingEventId = window.sessionStorage.getItem(PENDING_EVENT_KEY);
    if (!pendingEventId) return;
    if (!isFeatureEnabled('mobile.action.turn_submit')) {
      window.sessionStorage.removeItem(PENDING_EVENT_KEY);
      return;
    }

    setPendingTicketActivation(null);
    setConfirmationEventOverride(null);
    setScannedEventId(pendingEventId);
    setCurrentScreen('event-confirmation');
    window.sessionStorage.removeItem(PENDING_EVENT_KEY);
  }, [authReady, isAuthValid, isFeatureEnabled, setCurrentScreen, setScannedEventId]);

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
    if (!isFeatureEnabled('mobile.action.qr_scan')) {
      return { ok: false as const, error: 'Scansione QR temporaneamente disattivata.' };
    }
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

  const handleEventConfirm = async ({
    boostRequested,
  }: {
    boostRequested: boolean;
  }): Promise<
    | {
      ok: true;
      syncStatus: 'pending' | 'synced' | 'failed_boost_fallback';
      boostRequested: boolean;
      boostApplied: boolean;
      boostRejectionReason: string | null;
      rewards: Rewards;
    }
    | { ok: false; error: string }
  > => {
    if (!isFeatureEnabled('mobile.action.turn_submit')) {
      return { ok: false, error: 'Registrazione turni temporaneamente disattivata.' };
    }
    if (boostRequested && !isFeatureEnabled('mobile.action.turn_boost')) {
      return { ok: false, error: 'Boost turno temporaneamente disattivato.' };
    }

    const activationUserId = (authUserId ?? state.profile.email ?? '').trim();

    if (pendingTicketActivation?.mode === 'hash') {
      if (!activationUserId) {
        setCurrentScreen('welcome');
        return { ok: false, error: 'Sessione non valida. Effettua di nuovo il login.' };
      }

      const activation = await activateTicketHash(pendingTicketActivation.hash, activationUserId);
      if (!activation.ok) {
        return { ok: false, error: activation.error };
      }

      const resolvedEventId = activation.eventId ?? pendingTicketActivation.eventId;
      const turnResult = await registerTurn({
        eventId: resolvedEventId,
        roleId: state.profile.roleId,
        eventOverride: mapActivatedEvent(resolvedEventId, activation.event ?? pendingTicketActivation.event),
        boostRequested,
      });
      if (!turnResult.ok) {
        return { ok: false, error: turnResult.error || 'Ticket attivato, ma non e stato possibile registrare il turno.' };
      }

      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(resolvedEventId);
      return {
        ok: true,
        syncStatus: turnResult.syncStatus,
        boostRequested: turnResult.boostRequested,
        boostApplied: turnResult.boostApplied,
        boostRejectionReason: turnResult.boostRejectionReason,
        rewards: turnResult.rewards,
      };
    }

    if (pendingTicketActivation?.mode === 'manual') {
      if (!activationUserId) {
        setCurrentScreen('welcome');
        return { ok: false, error: 'Sessione non valida. Effettua di nuovo il login.' };
      }

      const activation = await activateTicketByDetails(
        pendingTicketActivation.eventId,
        pendingTicketActivation.ticketNumber,
        activationUserId
      );
      if (!activation.ok) {
        return { ok: false, error: activation.error };
      }

      const resolvedEventId = activation.eventId ?? pendingTicketActivation.eventId;
      const turnResult = await registerTurn({
        eventId: resolvedEventId,
        roleId: state.profile.roleId,
        eventOverride: mapActivatedEvent(resolvedEventId, activation.event),
        boostRequested,
      });
      if (!turnResult.ok) {
        return { ok: false, error: turnResult.error || 'Ticket attivato, ma non e stato possibile registrare il turno.' };
      }

      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      setScannedEventId(resolvedEventId);
      return {
        ok: true,
        syncStatus: turnResult.syncStatus,
        boostRequested: turnResult.boostRequested,
        boostApplied: turnResult.boostApplied,
        boostRejectionReason: turnResult.boostRejectionReason,
        rewards: turnResult.rewards,
      };
    }

    const turnResult = await registerTurn({
      eventId: scannedEventId,
      roleId: state.profile.roleId,
      eventOverride: confirmationEventOverride ?? undefined,
      boostRequested,
    });
    if (turnResult.ok) {
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      return {
        ok: true,
        syncStatus: turnResult.syncStatus,
        boostRequested: turnResult.boostRequested,
        boostApplied: turnResult.boostApplied,
        boostRejectionReason: turnResult.boostRejectionReason,
        rewards: turnResult.rewards,
      };
    }

    return { ok: false, error: turnResult.error || 'Non e stato possibile registrare il turno.' };
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

  const openQrScanner = useCallback(() => {
    if (!isFeatureEnabled('mobile.action.qr_scan')) {
      showFeatureDisabledAlert('Scansione QR');
      return;
    }
    setCurrentScreen('qr-scanner');
  }, [isFeatureEnabled, setCurrentScreen, showFeatureDisabledAlert]);

  const openSupport = useCallback(() => {
    if (!canViewAiSupport) {
      showFeatureDisabledAlert('Il Supporto AI');
      return;
    }
    setCurrentScreen('support');
  }, [canViewAiSupport, setCurrentScreen, showFeatureDisabledAlert]);

  const openTicketQrPrototype = useCallback(() => {
    if (!canViewTicketQrPrototype) {
      showFeatureDisabledAlert('La generazione ticket QR');
      return;
    }
    setCurrentScreen('ticket-qr-prototype');
  }, [canViewTicketQrPrototype, setCurrentScreen, showFeatureDisabledAlert]);

  const openTurns = useCallback(() => {
    if (!tabFeatureFlags.turns) {
      showFeatureDisabledAlert('La sezione turni');
      return;
    }
    handleTabChange('turns');
  }, [handleTabChange, showFeatureDisabledAlert, tabFeatureFlags.turns]);

  const openActivities = useCallback(() => {
    if (!tabFeatureFlags.activities) {
      showFeatureDisabledAlert('La sezione attivita');
      return;
    }
    handleTabChange('activities');
  }, [handleTabChange, showFeatureDisabledAlert, tabFeatureFlags.activities]);

  const openCareer = useCallback(() => {
    if (!tabFeatureFlags.career) {
      showFeatureDisabledAlert('La sezione carriera');
      return;
    }
    setCurrentScreen('career');
  }, [setCurrentScreen, showFeatureDisabledAlert, tabFeatureFlags.career]);

  const openEarnedTitles = useCallback(() => {
    if (!tabFeatureFlags.earnedTitles) {
      showFeatureDisabledAlert('La sezione titoli');
      return;
    }
    setCurrentScreen('earned-titles');
  }, [setCurrentScreen, showFeatureDisabledAlert, tabFeatureFlags.earnedTitles]);

  const openLeaderboardProfile = useCallback(
    (entry: LeaderboardEntry, isCurrentUser: boolean) => {
      if (isCurrentUser) {
        setSelectedLeaderboardEntry(null);
        handleTabChange('profile');
        return;
      }

      setSelectedLeaderboardEntry(entry);
      setCurrentScreen('public-profile');
    },
    [handleTabChange, setCurrentScreen]
  );

  const renderScreen = () => {
    const selectedEvent = confirmationEventOverride ?? events.find(e => e.id === scannedEventId);
    const selectedRole = roles.find(r => r.id === state.profile.roleId);
    const currentActivity = activities.find(a => a.id === selectedActivityId);
    const selectedLeaderboardRole = selectedLeaderboardEntry
      ? roles.find((role) => role.id === selectedLeaderboardEntry.roleId)?.name ?? 'Ruolo'
      : 'Ruolo';
    const accountSettingsScreen = (
      <AccountSettings
        userName={state.profile.name}
        email={state.profile.email}
        showAiSupport={canViewAiSupport}
        showTicketPrototype={canViewTicketQrPrototype}
        onBack={() => setCurrentScreen('profile')}
        onViewTerms={() => openLegal('terms', 'account-settings')}
        onViewPrivacy={() => openLegal('privacy', 'account-settings')}
        onViewSupport={openSupport}
        onViewTicketPrototype={openTicketQrPrototype}
        onChangePassword={() => {
          setIsPasswordRecovery(false);
          setCurrentScreen('change-password');
        }}
        onResetProgress={async () => {
          await resetProgress();
          handleTabChange('home');
          setCurrentScreen('role-selection');
        }}
        onLogout={handleLogout}
      />
    );

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
      case 'home': return (
        <Home
          userName={state.profile.name}
          userRole={selectedRole?.name ?? 'Ruolo'}
          level={state.profile.level}
          xp={state.profile.xp}
          xpToNextLevel={state.profile.xpToNextLevel}
          reputation={state.profile.reputation}
          cachet={state.profile.cachet}
          tokenAtcl={state.profile.tokenAtcl}
          pendingBoostRequests={pendingBoostRequests}
          turnSyncFeedback={turnSyncFeedback}
          onDismissTurnSyncFeedback={clearTurnSyncFeedback}
          allowScanQr={isFeatureEnabled('mobile.action.qr_scan')}
          allowTurnsSection={tabFeatureFlags.turns}
          allowActivitiesSection={tabFeatureFlags.activities}
          onScanQR={openQrScanner}
          onViewActivities={openActivities}
          onViewTurni={openTurns}
          onViewEventDetails={() => {
            if (!tabFeatureFlags.turns) {
              showFeatureDisabledAlert('La sezione turni');
              return;
            }
            setScannedEventId(upcomingEvent?.id ?? '');
            setCurrentScreen('event-details');
          }}
          onNavigateToEvent={() => openInMaps(upcomingEvent?.theatre ?? '')}
          upcomingEvent={upcomingEvent}
          totalTurns={turnStats.totalTurns}
          turnsThisMonth={turnStats.turnsThisMonth}
          uniqueTheatres={turnStats.uniqueTheatres}
          activitiesCount={activities.length}
          eventLoading={followedEventsLoading}
          statsLoading={statsLoading}
          newBadgesCount={newBadges.length}
          newBadgeTitle={newestNewBadge?.title}
          onDismissBadgeNotification={markBadgesSeen}
        />
      );
      case 'turns':
      case 'activities':
        return (
          <ActivitiesHub
            activeSection={activitiesSection}
            onSectionChange={setActivitiesSection}
            showTurns={tabFeatureFlags.turns}
            showActivities={tabFeatureFlags.activities}
            turnsView={
              <ATCLTurns
                events={events}
                isEventFollowed={isEventFollowed}
                onToggleFollow={(id: string) => isEventFollowed(id) ? unfollowEvent(id) : followEvent(id)}
                onViewMap={() => openEventsMap(events.map(e => e.theatre))}
                onViewEvent={(id: string) => { setScannedEventId(id); setCurrentScreen('event-details'); }}
                onScanQR={openQrScanner}
                canScanQr={isFeatureEnabled('mobile.action.qr_scan')}
                embedded
              />
            }
            activitiesView={
              <Activities
                activities={activities}
                slotsStatus={activitySlotsStatus}
                slotsLoading={activitySlotsLoading}
                isOnline={typeof navigator === 'undefined' ? true : navigator.onLine}
                canStartActivities={isFeatureEnabled('mobile.action.activity_start')}
                onStartActivity={(id: string) => {
                  if (!isFeatureEnabled('mobile.action.activity_start')) {
                    showFeatureDisabledAlert('Avvio attivita');
                    return;
                  }
                  setSelectedActivityId(id);
                  setCurrentScreen('activity-detail');
                }}
                embedded
              />
            }
          />
        );
      case 'leaderboard': return <Leaderboard onSelectEntry={openLeaderboardProfile} />;
      case 'qr-scanner':
        if (!isFeatureEnabled('mobile.action.qr_scan')) {
          return (
            <div className="min-h-screen pb-24">
              <div className="app-content px-6 pt-6 space-y-4">
                <Card>
                  <h3 className="text-white mb-2">Scansione QR non disponibile</h3>
                  <p className="text-[#b8b2b3] text-sm mb-4">
                    Questa funzione e temporaneamente disattivata dalla configurazione runtime.
                  </p>
                  <button
                    type="button"
                    className="text-sm text-[#f4bf4f] hover:text-[#e6a23c]"
                    onClick={() => handleTabChange('home')}
                  >
                    Torna alla Home
                  </button>
                </Card>
              </div>
            </div>
          );
        }
        return <QRScanner onClose={() => handleTabChange(activeTab === 'home' ? 'home' : 'activities')} onScan={handleQRScanAttempt} events={events} />;
      case 'event-confirmation': return (
        <EventConfirmation
          event={selectedEvent}
          role={selectedRole}
          cachet={state.profile.cachet}
          tokenAtcl={state.profile.tokenAtcl}
          pendingBoostRequests={pendingBoostRequests}
          allowBoost={isFeatureEnabled('mobile.action.turn_boost')}
          onConfirm={handleEventConfirm}
          onSuccess={() => handleTabChange('home')}
          onCancel={() => {
            setPendingTicketActivation(null);
            setConfirmationEventOverride(null);
            setScannedEventId('');
            handleTabChange(activeTab === 'home' ? 'home' : 'activities');
          }}
        />
      );
      case 'event-details': return <EventDetails event={selectedEvent} onBack={() => setCurrentScreen('home')} onNavigate={() => openInMaps(selectedEvent?.theatre ?? '')} />;
      case 'shop': return (
        <Shop
          cachet={state.profile.cachet}
          extraActivitySlots={state.profile.extraActivitySlots}
          items={shopCatalog}
          theatreOptions={theatreReputation.map((item) => ({
            theatre: item.theatre,
            reputation: item.reputation,
          }))}
          loading={shopCatalogLoading}
          canPurchase={isFeatureEnabled('mobile.action.shop_purchase')}
          onPurchase={purchaseShopItem}
        />
      );
      case 'activity-detail': return currentActivity && <ActivityDetail activity={currentActivity} onStart={() => {
        if (!isFeatureEnabled('mobile.action.activity_start')) {
          showFeatureDisabledAlert('Avvio attivita');
          return;
        }
        setActivityOutcome(null);
        setActivityCompletion(null);
        setCurrentScreen('activity-minigame');
      }} onClose={() => setCurrentScreen('activities')} />;
      case 'activity-minigame':
        return currentActivity && (
          <ActivityMinigame
            activity={currentActivity}
            onCancel={() => setCurrentScreen('activity-detail')}
            onComplete={(outcome) => {
              void (async () => {
                if (!isFeatureEnabled('mobile.action.activity_complete')) {
                  showFeatureDisabledAlert('Completamento attivita');
                  handleTabChange('activities');
                  return;
                }
                const completion = await completeActivity(selectedActivityId);
                if (!completion.ok) {
                  window.alert(completion.error);
                  handleTabChange('activities');
                  return;
                }
                setActivityOutcome(outcome);
                setActivityCompletion({
                  activity: completion.activity,
                  rewards: completion.rewards,
                });
                setCurrentScreen('activity-result');
              })();
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
          <Activities
            activities={activities}
            slotsStatus={activitySlotsStatus}
            slotsLoading={activitySlotsLoading}
            isOnline={typeof navigator === 'undefined' ? true : navigator.onLine}
            canStartActivities={isFeatureEnabled('mobile.action.activity_start')}
            onStartActivity={(id: string) => {
              if (!isFeatureEnabled('mobile.action.activity_start')) {
                showFeatureDisabledAlert('Avvio attivita');
                return;
              }
              setSelectedActivityId(id);
              setCurrentScreen('activity-detail');
            }}
          />
        );
      case 'profile': return <Profile userName={state.profile.name} userRole={selectedRole?.name ?? 'Ruolo'} level={state.profile.level} xp={state.profile.xp} xpTotal={state.profile.xpTotal} xpSulCampo={state.profile.xpField} reputationGlobal={state.profile.reputation} cachet={state.profile.cachet} tokenAtcl={state.profile.tokenAtcl} theatreReputation={theatreReputation.map(tr => ({ name: tr.theatre, reputation: tr.reputation }))} theatreReputationLoading={theatreReputationLoading} badgesUnlockedCount={unlockedBadges.length} newBadgesCount={newBadges.length} profileImage={state.profile.profileImage} onViewCarriera={openCareer} onViewTitoli={openEarnedTitles} onSettings={() => setCurrentScreen('account-settings')} onLogout={handleLogout} onUploadProfileImage={handleUploadImage} />;
      case 'public-profile':
        return selectedLeaderboardEntry ? (
          <PublicProfile
            userName={selectedLeaderboardEntry.name}
            userRole={selectedLeaderboardRole}
            xpTotal={selectedLeaderboardEntry.xpTotal}
            reputation={selectedLeaderboardEntry.reputation}
            cachet={selectedLeaderboardEntry.cachet}
            turnsCount={selectedLeaderboardEntry.turnsCount}
            theatres={publicProfileTheatres}
            theatresLoading={publicProfileTheatresLoading}
            profileImage={selectedLeaderboardEntry.profileImage}
            onBack={() => setCurrentScreen('leaderboard')}
          />
        ) : (
          <Leaderboard onSelectEntry={openLeaderboardProfile} />
        );
      case 'account-settings': return accountSettingsScreen;
      case 'support':
        return canViewAiSupport
          ? <SupportChat userName={state.profile.name} onBack={() => setCurrentScreen('account-settings')} />
          : accountSettingsScreen;
      case 'change-password': return <ChangePassword email={state.profile.email} mode={isPasswordRecovery ? 'recovery' : 'change'} onBack={() => { setIsPasswordRecovery(false); setCurrentScreen(isPasswordRecovery ? 'home' : 'account-settings'); }} onChangePassword={(current, next) => changePassword(next, current)} onSendResetEmail={() => sendPasswordResetEmail(state.profile.email)} />;
      case 'career': return <Career userRole={selectedRole?.name ?? 'Ruolo'} roleId={state.profile.roleId} roleStats={selectedRole?.stats ?? { presence: 0, precision: 0, leadership: 0, creativity: 0 }} turnStats={turnStats} badges={badges} turns={state.turns} roles={roles} level={state.profile.level} xp={state.profile.xp} xpToNextLevel={state.profile.xpToNextLevel} xpTotal={state.profile.xpTotal} xpSulCampo={state.profile.xpField} reputationGlobal={state.profile.reputation} onBack={() => setCurrentScreen('profile')} />;
      case 'terms': return <TermsAndConditions onBack={() => setCurrentScreen(legalReturnScreen)} />;
      case 'privacy': return <PrivacyPolicy onBack={() => setCurrentScreen(legalReturnScreen)} />;
      case 'earned-titles': return <EarnedTitles badges={badges} turnStats={turnStats} onBack={() => setCurrentScreen('profile')} onViewed={authReady && authUserId ? markBadgesSeen : undefined} />;
      case 'ticket-qr-prototype':
        return canViewTicketQrPrototype
          ? <TicketQrActivationPrototype userId={authUserId ?? state.profile.email ?? 'guest-user'} onBack={() => setCurrentScreen('account-settings')} />
          : accountSettingsScreen;
      default: return null;
    }
  };

  const enabledNavTabs = useMemo<Tab[]>(() => {
    const next: Tab[] = ['home'];
    if (tabFeatureFlags.turns || tabFeatureFlags.activities) next.push('activities');
    if (tabFeatureFlags.leaderboard) next.push('leaderboard');
    if (tabFeatureFlags.shop) next.push('shop');
    next.push('profile');
    return next;
  }, [tabFeatureFlags.activities, tabFeatureFlags.leaderboard, tabFeatureFlags.shop, tabFeatureFlags.turns]);

  const showBottomNav = ['home', 'turns', 'leaderboard', 'activities', 'shop', 'profile', 'public-profile', 'career', 'earned-titles'].includes(currentScreen);
  const normalizedError = useMemo(() => {
    if (!criticalError) return null;
    return {
      title: criticalError.title ?? 'Problema tecnico',
      message: criticalError.message ?? 'Non riusciamo a caricare i dati in questo momento. Riprova tra poco.',
      details: criticalError.details?.trim() ? criticalError.details : undefined,
    };
  }, [criticalError]);

  return (
    <div className="min-h-screen app-gradient app-shell">
      <ScreenTransition animationClass={screenAnimation} animationKey={screenAnimationKey}>
        <div className="app-frame">{renderScreen()}</div>
      </ScreenTransition>
      {showBottomNav && <BottomNav activeTab={activeTab} onTabChange={handleTabChange} enabledTabs={enabledNavTabs} />}
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

