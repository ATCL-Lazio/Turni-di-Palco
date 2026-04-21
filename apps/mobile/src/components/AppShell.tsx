import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameState, LeaderboardEntry, GameEvent, RoleId } from '../state/store';
import { useNavigator } from '../router';
import { getRouteConfig } from '../router/routes';
import { useFeatureGates, useActivityState } from '../handlers';
import { useQrHandlers } from '../handlers/useQrHandlers';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useQrLanding } from '../hooks/useQrLanding';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { hasStoredAuthState, PUBLIC_SCREENS } from '../lib/auth-storage';
import { openInMaps, openEventsMap } from '../lib/navigation-utils';
import { uploadProfileImage } from '../services/storage';
import { initErrorHandler, subscribeToCriticalErrors, getLastCriticalError, clearLastCriticalError } from '../services/error-handler';
import { PENDING_EVENT_KEY, readPendingEventFromUrl, stripEventLinkParams } from '../lib/event-linking';
import type { ActivatedEventPayload } from '../services/ticket-activation';

import { MainLayout } from '../layouts/MainLayout';
import { ScreenTransition } from './ui/ScreenTransition';
import { ErrorOverlay } from './ui/ErrorOverlay';
import { WelcomeTutorial } from './ui/WelcomeTutorial';

// Critical screen imports (static — needed for first load)
import { Welcome } from './screens/Welcome';
import { Login } from './screens/Login';
import { Signup } from './screens/Signup';
import { RoleSelection } from './screens/RoleSelection';
import { Home } from './screens/Home';
import { CookieConsent } from './screens/CookieConsent';

// Lazy-loaded screens (non-critical, loaded on demand)
const ATCLTurns = React.lazy(() => import('./screens/ATCLTurns').then(m => ({ default: m.ATCLTurns })));
const QRScanner = React.lazy(() => import('./screens/QRScanner').then(m => ({ default: m.QRScanner })));
const EventConfirmation = React.lazy(() => import('./screens/EventConfirmation').then(m => ({ default: m.EventConfirmation })));
const EventDetails = React.lazy(() => import('./screens/EventDetails').then(m => ({ default: m.EventDetails })));
const Activities = React.lazy(() => import('./screens/Activities').then(m => ({ default: m.Activities })));
const ActivitiesHub = React.lazy(() => import('./screens/ActivitiesHub').then(m => ({ default: m.ActivitiesHub })));
const ActivityDetail = React.lazy(() => import('./screens/ActivityDetail').then(m => ({ default: m.ActivityDetail })));
const ActivityMinigame = React.lazy(() => import('./screens/ActivityMinigame').then(m => ({ default: m.ActivityMinigame })));
const ActivityResult = React.lazy(() => import('./screens/ActivityResult').then(m => ({ default: m.ActivityResult })));
const Shop = React.lazy(() => import('./screens/Shop').then(m => ({ default: m.Shop })));
const Leaderboard = React.lazy(() => import('./screens/Leaderboard').then(m => ({ default: m.Leaderboard })));
const Profile = React.lazy(() => import('./screens/Profile').then(m => ({ default: m.Profile })));
const PublicProfile = React.lazy(() => import('./screens/PublicProfile').then(m => ({ default: m.PublicProfile })));
const AccountSettings = React.lazy(() => import('./screens/AccountSettings').then(m => ({ default: m.AccountSettings })));
const SupportChat = React.lazy(() => import('./screens/SupportChat').then(m => ({ default: m.SupportChat })));
const ChangePassword = React.lazy(() => import('./screens/ChangePassword').then(m => ({ default: m.ChangePassword })));
const Career = React.lazy(() => import('./screens/Career').then(m => ({ default: m.Career })));
const InstallApp = React.lazy(() => import('./screens/InstallApp').then(m => ({ default: m.InstallApp })));
const TermsAndConditions = React.lazy(() => import('./screens/TermsAndConditions').then(m => ({ default: m.TermsAndConditions })));
const PrivacyPolicy = React.lazy(() => import('./screens/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const EarnedTitles = React.lazy(() => import('./screens/EarnedTitles').then(m => ({ default: m.EarnedTitles })));
const TicketQrActivationPrototype = React.lazy(() => import('./screens/TicketQrActivationPrototype').then(m => ({ default: m.TicketQrActivationPrototype })));
import { Card } from './ui/Card';
import { Tab } from '../types/navigation';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}

export function AppShell() {
  const gameState = useGameState();
  const {
    authUserId, authReady, hasHydratedRemote, state, roles, events,
    activities, turnStats, statsLoading, theatreReputation,
    theatreReputationLoading, badges, followedEvents, followedEventsLoading,
    shopCatalog, shopCatalogLoading, purchaseShopItem,
    activitySlotsStatus, activitySlotsLoading,
    getEventPlan, planEvent, cancelEventPlan, markBadgesSeen,
    updateProfile, registerTurn, pendingBoostRequests, turnSyncFeedback, clearTurnSyncFeedback,
    completeActivity, resetProgress, deleteAccount, exportUserData, resetState,
    changePassword, sendPasswordResetEmail, featureFlags, isFeatureEnabled,
  } = gameState;

  // In-app info toast (replaces window.alert for feature-gate and activity errors)
  const [infoToast, setInfoToast] = useState<string | null>(null);

  // Feature gates
  const {
    tabFlags, isTabEnabled, showFeatureDisabledAlert,
    enabledNavTabs, canViewAiSupport, canViewTicketQrPrototype, roleJourneyEnabled,
  } = useFeatureGates(featureFlags, isFeatureEnabled, setInfoToast);

  // Navigator
  const nav = useNavigator();

  // Activity state
  const {
    activityOutcome, setActivityOutcome,
    activityCompletion, setActivityCompletion,
    activitiesSection, setActivitiesSection,
    selectedRole, recommendedActivityId, visibleActivities, roleJourney,
  } = useActivityState(activities, roles, state.profile.roleId as RoleId, roleJourneyEnabled);

  // Leaderboard / public profile state
  const [selectedLeaderboardEntry, setSelectedLeaderboardEntry] = useState<LeaderboardEntry | null>(null);
  const [publicProfileTheatres, setPublicProfileTheatres] = useState<Array<{ theatre: string; turnsCount: number }>>([]);
  const [publicProfileTheatresLoading, setPublicProfileTheatresLoading] = useState(false);

  // Tab animation state
  const [screenAnimation, setScreenAnimation] = useState('');
  const [screenAnimationKey, setScreenAnimationKey] = useState(0);
  const previousTabRef = useRef(nav.activeTab);

  // Online status
  const isOnline = useOnlineStatus();

  // Error overlay
  const [criticalError, setCriticalError] = useState<{ title?: string; message?: string; details?: string } | null>(null);

  // Ticket activation state
  type PendingTicketActivation =
    | { mode: 'hash'; hash: string; eventId: string; event?: ActivatedEventPayload }
    | { mode: 'manual'; eventId: string; ticketNumber: string };
  const [pendingTicketActivation, setPendingTicketActivation] = useState<PendingTicketActivation | null>(null);
  const [confirmationEventOverride, setConfirmationEventOverride] = useState<GameEvent | null>(null);

  // Derived state
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

  const selectedEvent = useMemo(
    () => confirmationEventOverride ?? events.find(e => e.id === nav.scannedEventId),
    [confirmationEventOverride, events, nav.scannedEventId],
  );
  const currentActivity = useMemo(
    () => visibleActivities.find(a => a.id === nav.selectedActivityId)
      ?? activities.find(a => a.id === nav.selectedActivityId),
    [activities, nav.selectedActivityId, visibleActivities],
  );

  // Auth hook
  const { authError, setAuthError, isDemoMode, handleLogin, handleSignup, handleLogout } = useAuth(
    state.profile,
    updateProfile,
    (screen, isRecovery) => {
      if (isRecovery !== undefined) nav.setIsPasswordRecovery(isRecovery);
      if (screen === 'home') {
        const shouldAutoHome = nav.screen === 'welcome' || nav.screen === 'login';
        if (shouldAutoHome) nav.navigate('home');
      } else {
        nav.navigate(screen);
      }
    },
    () => {
      setAuthError(null);
      nav.setIsPasswordRecovery(false);
      nav.setLegalReturnScreen('welcome');
      nav.setSelectedActivityId('');
      nav.setScannedEventId('');
      setActivityOutcome(null);
      setActivityCompletion(null);
      setSelectedLeaderboardEntry(null);
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      resetState();
      nav.navigate('welcome');
    },
  );

  // Tab change handler with feature gates
  const handleTabChange = useCallback((tab: Tab) => {
    if (tab === 'turns') {
      if (!tabFlags.turns) { showFeatureDisabledAlert('La sezione turni'); nav.switchTab('home'); return; }
      setActivitiesSection('turns');
      nav.switchTab('activities');
      return;
    }
    if (tab === 'activities') {
      if (!(tabFlags.turns || tabFlags.activities)) { showFeatureDisabledAlert('La sezione attivita'); nav.switchTab('home'); return; }
      if (!tabFlags.activities && tabFlags.turns) setActivitiesSection('turns');
      else if (tabFlags.activities) setActivitiesSection('activities');
      nav.switchTab('activities');
      return;
    }
    if (!isTabEnabled(tab)) { showFeatureDisabledAlert(`La sezione ${tab}`); nav.switchTab('home'); return; }
    nav.switchTab(tab);
  }, [isTabEnabled, nav, showFeatureDisabledAlert, tabFlags]);

  // QR handlers
  const { handleQRScanAttempt, handleEventConfirm } = useQrHandlers({
    authUserId, authReady, isAuthValid, events,
    profileEmail: state.profile.email,
    profileRoleId: state.profile.roleId as RoleId,
    isFeatureEnabled, registerTurn,
    navigate: nav.navigate,
    setScannedEventId: nav.setScannedEventId,
    pendingTicketActivation, setPendingTicketActivation,
    confirmationEventOverride, setConfirmationEventOverride,
    scannedEventId: nav.scannedEventId,
  });

  // Notification and QR landing hooks
  useNotifications(upcomingEvent, newestNewBadge ?? undefined);
  useQrLanding(authReady, isAuthValid, (target) => nav.navigate(target));

  // Navigation action helpers
  const openQrScanner = useCallback(() => {
    if (!isFeatureEnabled('qr_scan')) {
      showFeatureDisabledAlert('Registrazione biglietto');
      return;
    }
    nav.navigate('qr-scanner');
  }, [isFeatureEnabled, nav, showFeatureDisabledAlert]);

  const openSupport = useCallback(() => {
    if (!canViewAiSupport) { showFeatureDisabledAlert('Il Supporto AI'); return; }
    nav.navigate('support');
  }, [canViewAiSupport, nav, showFeatureDisabledAlert]);

  const openTicketQrPrototype = useCallback(() => {
    if (!canViewTicketQrPrototype) { showFeatureDisabledAlert('La generazione ticket QR'); return; }
    nav.navigate('ticket-qr-prototype');
  }, [canViewTicketQrPrototype, nav, showFeatureDisabledAlert]);

  const openTurns = useCallback(() => {
    if (!tabFlags.turns) { showFeatureDisabledAlert('La sezione turni'); return; }
    handleTabChange('turns');
  }, [handleTabChange, showFeatureDisabledAlert, tabFlags.turns]);

  const openActivities = useCallback(() => {
    if (!tabFlags.activities) { showFeatureDisabledAlert('La sezione attivita'); return; }
    handleTabChange('activities');
  }, [handleTabChange, showFeatureDisabledAlert, tabFlags.activities]);

  const openCareer = useCallback(() => {
    if (!tabFlags.career) { showFeatureDisabledAlert('La sezione carriera'); return; }
    nav.navigate('career');
  }, [nav, showFeatureDisabledAlert, tabFlags.career]);

  const openEarnedTitles = useCallback(() => {
    if (!tabFlags.earnedTitles) { showFeatureDisabledAlert('La sezione titoli'); return; }
    nav.navigate('earned-titles');
  }, [nav, showFeatureDisabledAlert, tabFlags.earnedTitles]);

  const openLeaderboardProfile = useCallback((entry: LeaderboardEntry, isCurrentUser: boolean) => {
    if (isCurrentUser) { setSelectedLeaderboardEntry(null); handleTabChange('profile'); return; }
    setSelectedLeaderboardEntry(entry);
    nav.navigate('public-profile');
  }, [handleTabChange, nav]);

  const handleUploadImage = useCallback(async (file: File) => {
    if (!authUserId) return;
    const url = await uploadProfileImage(authUserId, file);
    updateProfile({ profileImage: url });
  }, [authUserId, updateProfile]);

  // === Effects ===

  // Error handler init
  useEffect(() => {
    initErrorHandler();
    const pending = getLastCriticalError();
    if (pending) setCriticalError(pending);
    return subscribeToCriticalErrors(payload => setCriticalError(prev => prev ?? payload));
  }, []);

  // Lock body scroll on critical error
  useEffect(() => {
    if (!criticalError) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [criticalError]);

  // Tab animation
  useEffect(() => {
    if (nav.activeTab === previousTabRef.current) return;
    const tabOrder = ['home', 'leaderboard', 'activities', 'shop', 'profile'];
    const currentIndex = tabOrder.indexOf(nav.activeTab);
    const previousIndex = tabOrder.indexOf(previousTabRef.current);
    let animation: string;
    if (currentIndex === -1 || previousIndex === -1) animation = 'tab-fade-in';
    else if (currentIndex > previousIndex) animation = 'tab-slide-right';
    else animation = 'tab-slide-left';
    setScreenAnimation(animation);
    setScreenAnimationKey(v => v + 1);
    previousTabRef.current = nav.activeTab;
  }, [nav.activeTab]);

  // Redirect turns tab to activities hub
  useEffect(() => {
    if (nav.activeTab !== 'turns') return;
    setActivitiesSection('turns');
    nav.switchTab('activities');
  }, [nav.activeTab, nav]);

  // Public profile theatres fetch
  useEffect(() => {
    if (!selectedLeaderboardEntry || !supabase) {
      setPublicProfileTheatres([]);
      setPublicProfileTheatresLoading(false);
      return;
    }
    let cancelled = false;
    type Row = { theatre: string | null; turns_count: number | null };
    const load = async () => {
      setPublicProfileTheatresLoading(true);
      try {
        const { data, error } = await supabase!.rpc('get_public_profile_theatres', { p_user_id: selectedLeaderboardEntry.id });
        if (error) throw error;
        if (cancelled) return;
        setPublicProfileTheatres(
          ((data as Row[]) ?? []).filter(r => Boolean(r.theatre)).map(r => ({ theatre: r.theatre ?? 'Teatro', turnsCount: r.turns_count ?? 0 })),
        );
      } catch (e) {
        console.warn('Supabase public profile theatres fetch failed', e);
        if (!cancelled) setPublicProfileTheatres([]);
      } finally {
        if (!cancelled) setPublicProfileTheatresLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedLeaderboardEntry]);

  // Auth guard: redirect to welcome if session lost
  useEffect(() => {
    if (PUBLIC_SCREENS.has(nav.screen)) return;
    if (isSupabaseConfigured) {
      if (!authReady) return;
      if (authUserId) return;
      if (hasStoredAuthState()) return;
    } else {
      if (hasValidEmail) return;
      if (hasStoredAuthState()) return;
    }
    setAuthError(null);
    nav.setIsPasswordRecovery(false);
    nav.setLegalReturnScreen('welcome');
    nav.setSelectedActivityId('');
    nav.setScannedEventId('');
    resetState();
    nav.navigate('welcome');
  }, [authReady, authUserId, nav, hasValidEmail, resetState, setAuthError]);

  // Event link from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pendingFromUrl = readPendingEventFromUrl(window.location.href);
    if (!pendingFromUrl?.eventId) return;
    window.sessionStorage.setItem(PENDING_EVENT_KEY, pendingFromUrl.eventId);
    try { window.history.replaceState({}, '', stripEventLinkParams(window.location.href)); } catch { /* ignore */ }
    if (authReady && isAuthValid) {
      if (!isFeatureEnabled('registra_turno')) { window.sessionStorage.removeItem(PENDING_EVENT_KEY); return; }
      setPendingTicketActivation(null);
      setConfirmationEventOverride(null);
      nav.setScannedEventId(pendingFromUrl.eventId);
      nav.navigate('event-confirmation');
      window.sessionStorage.removeItem(PENDING_EVENT_KEY);
    }
  }, [authReady, isAuthValid, isFeatureEnabled, nav]);

  // Pending event from session storage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authReady || !isAuthValid) return;
    const pendingEventId = window.sessionStorage.getItem(PENDING_EVENT_KEY);
    if (!pendingEventId) return;
    if (!isFeatureEnabled('registra_turno')) { window.sessionStorage.removeItem(PENDING_EVENT_KEY); return; }
    setPendingTicketActivation(null);
    setConfirmationEventOverride(null);
    nav.setScannedEventId(pendingEventId);
    nav.navigate('event-confirmation');
    window.sessionStorage.removeItem(PENDING_EVENT_KEY);
  }, [authReady, isAuthValid, isFeatureEnabled, nav]);

  // === Screen Renderer ===
  const renderScreen = () => {
    const selectedLeaderboardRole = selectedLeaderboardEntry
      ? roles.find(r => r.id === selectedLeaderboardEntry.roleId)?.name ?? 'Ruolo' : 'Ruolo';

    switch (nav.screen) {
      case 'cookie-consent':
        return (
          <CookieConsent
            onAccept={() => nav.navigate('welcome')}
            onViewPrivacy={() => nav.openLegal('privacy', 'welcome')}
          />
        );

      case 'welcome':
        return <Welcome onStart={() => nav.navigate('signup')} onLogin={() => nav.navigate('login')} />;

      case 'login':
        return <Login onBack={() => nav.navigate('welcome')} onLogin={handleLogin} onSignup={() => nav.navigate('signup')} onForgotPassword={() => nav.navigate('change-password')} errorMessage={authError} />;

      case 'signup':
        return <Signup onBack={() => nav.navigate('welcome')} onSignup={handleSignup} onLogin={() => nav.navigate('login')} onViewTerms={() => nav.openLegal('terms', 'signup')} onViewPrivacy={() => nav.openLegal('privacy', 'signup')} errorMessage={authError} />;

      case 'install':
        return <InstallApp onContinue={() => nav.navigate(state.profile.roleId ? 'home' : 'welcome')} onDismiss={() => nav.navigate(state.profile.roleId ? 'home' : 'welcome')} />;

      case 'role-selection':
        return <RoleSelection roles={roles} showRoleJourney={roleJourneyEnabled} onComplete={role => { updateProfile({ roleId: role.id }); nav.navigate('home'); }} />;

      case 'home':
        return (
          <Home
            userName={state.profile.name} userRole={selectedRole?.name ?? 'Ruolo'}
            level={state.profile.level} xp={state.profile.xp} xpToNextLevel={state.profile.xpToNextLevel}
            reputation={state.profile.reputation} cachet={state.profile.cachet} tokenAtcl={state.profile.tokenAtcl}
            pendingBoostRequests={pendingBoostRequests} turnSyncFeedback={turnSyncFeedback} onDismissTurnSyncFeedback={clearTurnSyncFeedback}
            allowScanQr={isFeatureEnabled('qr_scan')} allowTurnsSection={tabFlags.turns} allowActivitiesSection={tabFlags.activities}
            onScanQR={openQrScanner} onViewActivities={openActivities} onOpenRoleJourney={openActivities} onViewTurni={openTurns}
            onViewEventDetails={() => {
              if (!tabFlags.turns) { showFeatureDisabledAlert('La sezione turni'); return; }
              nav.setScannedEventId(upcomingEvent?.id ?? '');
              nav.navigate('event-details');
            }}
            onNavigateToEvent={() => openInMaps(upcomingEvent?.theatre ?? '')}
            upcomingEvent={upcomingEvent} totalTurns={turnStats.totalTurns} turnsThisMonth={turnStats.turnsThisMonth}
            uniqueTheatres={turnStats.uniqueTheatres} activitiesCount={visibleActivities.length} roleJourney={roleJourney}
            eventLoading={followedEventsLoading} statsLoading={statsLoading}
            newBadgesCount={newBadges.length} newBadgeTitle={newestNewBadge?.title} onDismissBadgeNotification={markBadgesSeen}
          />
        );

      case 'turns':
      case 'activities':
        return (
          <ActivitiesHub
            activeSection={activitiesSection} onSectionChange={setActivitiesSection}
            showTurns={tabFlags.turns} showActivities={tabFlags.activities}
            turnsView={
              <ATCLTurns events={events} roles={roles} getEventPlan={getEventPlan}
                onPlanEvent={(id: string) => { void planEvent(id, state.profile.roleId as RoleId); }}
                onCancelPlanning={(id: string) => { void cancelEventPlan(id); }}
                onEditPlanning={(id: string) => { nav.setScannedEventId(id); nav.navigate('event-details'); }}
                onViewMap={() => openEventsMap(events.map(e => e.theatre))}
                onViewEvent={(id: string) => { nav.setScannedEventId(id); nav.navigate('event-details'); }}
                onScanQR={openQrScanner} canScanQr={isFeatureEnabled('qr_scan')} embedded />
            }
            activitiesView={
              <Activities activities={visibleActivities}
                activeRole={roleJourneyEnabled ? selectedRole : undefined}
                slotsStatus={activitySlotsStatus} slotsLoading={activitySlotsLoading}
                isOnline={typeof navigator === 'undefined' ? true : navigator.onLine}
                canStartActivities={isFeatureEnabled('avvia_attivita')}
                recommendedActivityId={roleJourneyEnabled ? recommendedActivityId : undefined}
                onStartActivity={(id: string) => {
                  if (!isFeatureEnabled('avvia_attivita')) { showFeatureDisabledAlert('Avvio attivita'); return; }
                  nav.setSelectedActivityId(id);
                  nav.navigate('activity-detail');
                }} embedded />
            }
          />
        );

      case 'leaderboard':
        return <Leaderboard onSelectEntry={openLeaderboardProfile} />;

      case 'qr-scanner':
        if (!isFeatureEnabled('qr_scan')) {
          return (
            <div className="min-h-screen pb-24">
              <div className="app-content px-6 pt-6 space-y-4">
                <Card>
                  <h3 className="text-white mb-2">Registrazione non disponibile</h3>
                  <p className="text-[#b8b2b3] text-sm mb-4">Questa funzione e temporaneamente disattivata dalla configurazione runtime.</p>
                  <button type="button" className="text-sm text-[#f4bf4f] hover:text-[#e6a23c]" onClick={() => handleTabChange('home')}>Torna alla Home</button>
                </Card>
              </div>
            </div>
          );
        }
        return <QRScanner onClose={() => handleTabChange(nav.activeTab === 'home' ? 'home' : 'activities')} onScan={handleQRScanAttempt} events={events} />;

      case 'event-confirmation':
        return (
          <EventConfirmation event={selectedEvent} role={selectedRole} cachet={state.profile.cachet} tokenAtcl={state.profile.tokenAtcl}
            pendingBoostRequests={pendingBoostRequests} allowBoost={isFeatureEnabled('boost_turno')}
            onConfirm={handleEventConfirm} onSuccess={() => handleTabChange('home')}
            onCancel={() => { setPendingTicketActivation(null); setConfirmationEventOverride(null); nav.setScannedEventId(''); handleTabChange(nav.activeTab === 'home' ? 'home' : 'activities'); }} />
        );

      case 'event-details':
        return (
          <EventDetails
            event={selectedEvent}
            roles={roles}
            currentRoleId={state.profile.roleId as RoleId}
            planning={selectedEvent ? getEventPlan(selectedEvent.id) : null}
            onBack={() => nav.navigate('home')}
            onNavigate={() => openInMaps(selectedEvent?.theatre ?? '')}
            onSavePlanning={planEvent}
            onClearPlanning={cancelEventPlan}
          />
        );

      case 'shop':
        return (
          <Shop cachet={state.profile.cachet} extraActivitySlots={state.profile.extraActivitySlots}
            items={shopCatalog} theatreOptions={theatreReputation.map(item => ({ theatre: item.theatre, reputation: item.reputation }))}
            loading={shopCatalogLoading} canPurchase={isFeatureEnabled('acquisti')} onPurchase={purchaseShopItem} />
        );

      case 'activity-detail':
        return currentActivity && (
          <ActivityDetail activity={currentActivity} role={roleJourneyEnabled ? selectedRole : undefined}
            onStart={() => {
              if (!isFeatureEnabled('avvia_attivita')) { showFeatureDisabledAlert('Avvio attivita'); return; }
              setActivityOutcome(null); setActivityCompletion(null); nav.navigate('activity-minigame');
            }}
            onClose={() => nav.navigate('activities')} />
        );

      case 'activity-minigame':
        return currentActivity && (
          <ActivityMinigame activity={currentActivity} roleId={roleJourneyEnabled ? selectedRole?.id : undefined}
            roleStats={roleJourneyEnabled ? selectedRole?.stats ?? null : null}
            onCancel={() => nav.navigate('activity-detail')}
            onComplete={outcome => {
              void (async () => {
                if (!isFeatureEnabled('completa_attivita')) { showFeatureDisabledAlert('Completamento attivita'); handleTabChange('activities'); return; }
                const completion = await completeActivity(nav.selectedActivityId, outcome);
                if (!completion.ok) { setInfoToast(completion.error ?? 'Errore nel completamento attività.'); handleTabChange('activities'); return; }
                setActivityOutcome(outcome);
                setActivityCompletion({ activity: completion.activity, rewards: completion.rewards });
                nav.navigate('activity-result');
              })();
            }} />
        );

      case 'activity-result':
        return activityCompletion && activityOutcome ? (
          <ActivityResult activity={activityCompletion.activity} rewards={activityCompletion.rewards} outcome={activityOutcome} onDone={() => handleTabChange('activities')} />
        ) : (
          <Activities activities={visibleActivities} activeRole={roleJourneyEnabled ? selectedRole : undefined}
            slotsStatus={activitySlotsStatus} slotsLoading={activitySlotsLoading}
            isOnline={typeof navigator === 'undefined' ? true : navigator.onLine}
            canStartActivities={isFeatureEnabled('avvia_attivita')}
            recommendedActivityId={roleJourneyEnabled ? recommendedActivityId : undefined}
            onStartActivity={(id: string) => {
              if (!isFeatureEnabled('avvia_attivita')) { showFeatureDisabledAlert('Avvio attivita'); return; }
              nav.setSelectedActivityId(id); nav.navigate('activity-detail');
            }} />
        );

      case 'profile':
        return (
          <Profile userName={state.profile.name} userRole={selectedRole?.name ?? 'Ruolo'}
            level={state.profile.level} xp={state.profile.xp} xpTotal={state.profile.xpTotal}
            xpSulCampo={state.profile.xpField} reputationGlobal={state.profile.reputation}
            cachet={state.profile.cachet} tokenAtcl={state.profile.tokenAtcl}
            theatreReputation={theatreReputation.map(tr => ({ name: tr.theatre, reputation: tr.reputation }))}
            theatreReputationLoading={theatreReputationLoading}
            badgesUnlockedCount={unlockedBadges.length} newBadgesCount={newBadges.length}
            profileImage={state.profile.profileImage} showCarriera={tabFlags.career}
            onViewCarriera={openCareer} onViewTitoli={openEarnedTitles}
            onSettings={() => nav.navigate('account-settings')} onLogout={handleLogout}
            onUploadProfileImage={handleUploadImage} />
        );

      case 'public-profile':
        return selectedLeaderboardEntry ? (
          <PublicProfile userName={selectedLeaderboardEntry.name} userRole={selectedLeaderboardRole}
            xpTotal={selectedLeaderboardEntry.xpTotal} reputation={selectedLeaderboardEntry.reputation}
            cachet={selectedLeaderboardEntry.cachet} turnsCount={selectedLeaderboardEntry.turnsCount}
            theatres={publicProfileTheatres} theatresLoading={publicProfileTheatresLoading}
            profileImage={selectedLeaderboardEntry.profileImage} onBack={() => nav.navigate('leaderboard')} />
        ) : <Leaderboard onSelectEntry={openLeaderboardProfile} />;

      case 'account-settings':
        return (
          <AccountSettings userName={state.profile.name} email={state.profile.email}
            showAiSupport={canViewAiSupport} showTicketPrototype={canViewTicketQrPrototype}
            leaderboardVisible={state.profile.leaderboardVisible}
            onBack={() => nav.navigate('profile')} onViewTerms={() => nav.openLegal('terms', 'account-settings')}
            onViewPrivacy={() => nav.openLegal('privacy', 'account-settings')}
            onViewSupport={openSupport} onViewTicketPrototype={openTicketQrPrototype}
            onChangePassword={() => { nav.setIsPasswordRecovery(false); nav.navigate('change-password'); }}
            onResetProgress={async () => { await resetProgress(); handleTabChange('home'); nav.navigate('role-selection'); }}
            onResetTutorial={() => { gameState.resetTutorial(); nav.navigate('home'); }}
            onDeleteAccount={deleteAccount}
            onExportData={exportUserData}
            onToggleLeaderboard={(visible) => updateProfile({ leaderboardVisible: visible })}
            onLogout={handleLogout} />
        );

      case 'support':
        return canViewAiSupport
          ? <SupportChat userName={state.profile.name} userId={authUserId ?? undefined} onBack={() => nav.navigate('account-settings')} />
          : <AccountSettings userName={state.profile.name} email={state.profile.email}
              showAiSupport={canViewAiSupport} showTicketPrototype={canViewTicketQrPrototype}
              leaderboardVisible={state.profile.leaderboardVisible}
              onBack={() => nav.navigate('profile')} onViewTerms={() => nav.openLegal('terms', 'account-settings')}
              onViewPrivacy={() => nav.openLegal('privacy', 'account-settings')}
              onViewSupport={openSupport} onViewTicketPrototype={openTicketQrPrototype}
              onChangePassword={() => { nav.setIsPasswordRecovery(false); nav.navigate('change-password'); }}
              onResetProgress={async () => { await resetProgress(); handleTabChange('home'); nav.navigate('role-selection'); }}
              onResetTutorial={() => { gameState.resetTutorial(); nav.navigate('home'); }}
              onDeleteAccount={deleteAccount}
              onExportData={exportUserData}
              onToggleLeaderboard={(visible) => updateProfile({ leaderboardVisible: visible })}
              onLogout={handleLogout} />;

      case 'change-password':
        return (
          <ChangePassword email={state.profile.email} mode={nav.isPasswordRecovery ? 'recovery' : 'change'}
            onBack={() => { nav.setIsPasswordRecovery(false); nav.navigate(nav.isPasswordRecovery ? 'home' : 'account-settings'); }}
            onChangePassword={(current, next) => changePassword(next, current)}
            onSendResetEmail={() => sendPasswordResetEmail(state.profile.email)} />
        );

      case 'career':
        return (
          <Career userRole={selectedRole?.name ?? 'Ruolo'} roleId={state.profile.roleId}
            roleStats={selectedRole?.stats ?? { presence: 0, precision: 0, leadership: 0, creativity: 0 }}
            turnStats={turnStats} badges={badges} turns={state.turns} roles={roles}
            level={state.profile.level} xp={state.profile.xp} xpToNextLevel={state.profile.xpToNextLevel}
            xpTotal={state.profile.xpTotal} xpSulCampo={state.profile.xpField}
            tokenAtcl={state.profile.tokenAtcl}
            reputationGlobal={state.profile.reputation} onBack={() => nav.navigate('profile')} />
        );

      case 'terms':
        return <TermsAndConditions onBack={() => nav.navigate(nav.legalReturnScreen)} />;

      case 'privacy':
        return <PrivacyPolicy onBack={() => nav.navigate(nav.legalReturnScreen)} />;

      case 'earned-titles':
        return <EarnedTitles badges={badges} turnStats={turnStats} onBack={() => nav.navigate('profile')} onViewed={authReady && authUserId ? markBadgesSeen : undefined} />;

      case 'ticket-qr-prototype':
        return canViewTicketQrPrototype
          ? <TicketQrActivationPrototype userId={authUserId ?? state.profile.email ?? 'guest-user'} onBack={() => nav.navigate('account-settings')} />
          : <AccountSettings userName={state.profile.name} email={state.profile.email}
              showAiSupport={canViewAiSupport} showTicketPrototype={canViewTicketQrPrototype}
              leaderboardVisible={state.profile.leaderboardVisible}
              onBack={() => nav.navigate('profile')} onViewTerms={() => nav.openLegal('terms', 'account-settings')}
              onViewPrivacy={() => nav.openLegal('privacy', 'account-settings')}
              onViewSupport={openSupport} onViewTicketPrototype={openTicketQrPrototype}
              onChangePassword={() => { nav.setIsPasswordRecovery(false); nav.navigate('change-password'); }}
              onResetProgress={async () => { await resetProgress(); handleTabChange('home'); nav.navigate('role-selection'); }}
              onResetTutorial={() => { gameState.resetTutorial(); nav.navigate('home'); }}
              onDeleteAccount={deleteAccount}
              onExportData={exportUserData}
              onToggleLeaderboard={(visible) => updateProfile({ leaderboardVisible: visible })}
              onLogout={handleLogout} />;

      default:
        return null;
    }
  };

  // Determine layout
  const routeConfig = getRouteConfig(nav.screen);

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
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[998] bg-[#2a1f14] border-b border-[#f4bf4f]/30 px-4 py-2 text-center text-sm text-[#f4bf4f]">
          Sei offline — le modifiche saranno sincronizzate al ritorno della connessione
        </div>
      )}
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-[997] bg-[#1a1617] border-b border-[#a82847]/40 px-4 py-2 text-center text-sm text-[#b8b2b3]">
          Modalità demo — i dati non vengono salvati
        </div>
      )}
      {infoToast && (
        <div role="status" aria-live="polite"
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-4 right-4 z-[999] flex items-center justify-between gap-3 rounded-xl bg-[#2a1f14] border border-[#f4bf4f]/30 px-4 py-3 shadow-lg text-sm text-[#f4bf4f]">
          <span>{infoToast}</span>
          <button type="button" onClick={() => setInfoToast(null)}
            className="shrink-0 text-[#b8b2b3] hover:text-white text-lg leading-none" aria-label="Chiudi">✕</button>
        </div>
      )}
      <ScreenTransition animationClass={screenAnimation} animationKey={screenAnimationKey}>
        <Suspense fallback={<div className="min-h-screen app-gradient flex items-center justify-center"><div className="animate-shimmer h-8 w-32 rounded-lg bg-[#1a1617]" /></div>}>
        {routeConfig.showBottomNav ? (
          <MainLayout activeTab={nav.activeTab} enabledTabs={enabledNavTabs} onTabChange={handleTabChange}>
            {renderScreen()}
          </MainLayout>
        ) : (
          <div className="app-frame">{renderScreen()}</div>
        )}
        </Suspense>
      </ScreenTransition>

      {nav.screen === 'home' && !state.profile.tutorialCompleted && (
        <WelcomeTutorial
          userName={state.profile.name}
          onComplete={() => gameState.completeTutorial()}
        />
      )}

      {normalizedError && (
        <ErrorOverlay
          title={normalizedError.title}
          message={normalizedError.message}
          details={normalizedError.details}
          onReload={() => window.location.reload()}
          onHome={() => { clearLastCriticalError(); setCriticalError(null); nav.switchTab('home'); nav.navigate('home'); }}
        />
      )}
    </div>
  );
}
