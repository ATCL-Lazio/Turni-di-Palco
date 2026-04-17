import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { MetricTile } from '../ui/MetricTile';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import {
  Play,
  Calendar,
  TrendingUp,
  Award,
  ChevronRight,
  Navigation,
  CalendarPlus,
  X,
  Bell,
  Coins,
  Zap,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { GameEvent, TurnSyncFeedback } from '../../state/store';
import { ScanQRCard } from '../ScanQRCard';
import { AtclPromoBanner } from '../AtclPromoBanner';
import { useAtclPromotion } from '../../hooks/useAtclPromotion';
import { useAtclNewsTicker } from '../../hooks/useAtclNewsTicker';
import { AtclNewsTicker } from '../AtclNewsTicker';

type EventState = 'loading' | 'error' | 'empty' | 'ready';

interface RoleJourneyData {
  eyebrow?: string;
  headline: string;
  summary: string;
  recommendedActivityTitle?: string;
  starterBadgeLabels?: string[];
  objectives?: string[];
  homeMessage?: string;
  ctaLabel?: string;
}

interface HomeProps {
  userName: string;
  userRole: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  reputation: number;
  cachet: number;
  tokenAtcl: number;
  pendingBoostRequests?: number;
  turnSyncFeedback?: TurnSyncFeedback | null;
  onDismissTurnSyncFeedback?: () => void;
  totalTurns: number;
  turnsThisMonth: number;
  uniqueTheatres: number;
  newBadgesCount?: number;
  newBadgeTitle?: string;
  onDismissBadgeNotification?: () => void;
  upcomingEvent?: GameEvent;
  activitiesCount: number;
  roleJourney?: RoleJourneyData | null;
  eventLoading?: boolean;
  eventError?: boolean;
  statsLoading?: boolean;
  allowScanQr?: boolean;
  allowTurnsSection?: boolean;
  allowActivitiesSection?: boolean;
  onScanQR: () => void;
  onViewActivities: () => void;
  onOpenRoleJourney?: () => void;
  onViewTurni: () => void;
  onViewEventDetails: () => void;
  onNavigateToEvent: () => void;
}

export function Home({
  userName,
  userRole,
  level,
  xp,
  xpToNextLevel,
  reputation,
  cachet,
  tokenAtcl,
  pendingBoostRequests = 0,
  turnSyncFeedback = null,
  onDismissTurnSyncFeedback,
  totalTurns,
  turnsThisMonth,
  uniqueTheatres,
  newBadgesCount = 0,
  newBadgeTitle,
  onDismissBadgeNotification,
  upcomingEvent,
  activitiesCount,
  roleJourney = null,
  eventLoading = false,
  eventError = false,
  statsLoading = false,
  allowScanQr = true,
  allowTurnsSection = true,
  allowActivitiesSection = true,
  onScanQR,
  onViewActivities,
  onOpenRoleJourney,
  onViewTurni,
  onViewEventDetails,
  onNavigateToEvent,
}: HomeProps) {
  const eventState: EventState = eventError ? 'error' : eventLoading ? 'loading' : !upcomingEvent ? 'empty' : 'ready';
  const homePromotion = useAtclPromotion('home');
  const homeTickerItems = useAtclNewsTicker(18);
  const showHomeTicker = homeTickerItems.length > 1;

  return (
    <Screen withBottomNavPadding>
      <HomeHeader
        userName={userName}
        userRole={userRole}
        newBadgesCount={newBadgesCount}
        newBadgeTitle={newBadgeTitle}
        onDismissBadgeNotification={onDismissBadgeNotification}
      />

      <div data-tutorial="stats">
        <StatsGrid
          level={level}
          xp={xp}
          xpToNextLevel={xpToNextLevel}
          reputation={reputation}
        />
      </div>

      <div data-tutorial="economy">
        <EconomyCard cachet={cachet} tokenAtcl={tokenAtcl} />
      </div>

      {pendingBoostRequests > 0 && (
        <Card className="bg-[--color-warning-soft-bg] border border-[--color-gold-400]/30">
          <p className="text-sm text-[--color-gold-400]">
            Boost in verifica: {pendingBoostRequests} richiesta/e in coda offline.
          </p>
        </Card>
      )}

      <TurnSyncFeedbackCard
        feedback={turnSyncFeedback}
        onDismiss={onDismissTurnSyncFeedback}
      />

      {roleJourney && (
        <RoleJourneyCard
          journey={roleJourney}
          onOpen={onOpenRoleJourney ?? onViewActivities}
        />
      )}

      {allowScanQr && <ScanQRCard onScanQR={onScanQR} />}

      {showHomeTicker ? (
        <AtclNewsTicker items={homeTickerItems} />
      ) : homePromotion ? (
        <AtclPromoBanner promotion={homePromotion} />
      ) : null}

      {allowTurnsSection && (
        <UpcomingEventSection
          eventState={eventState}
          upcomingEvent={upcomingEvent}
          totalTurns={totalTurns}
          allowScanQr={allowScanQr}
          onScanQR={onScanQR}
          onViewTurni={onViewTurni}
          onViewEventDetails={onViewEventDetails}
          onNavigateToEvent={onNavigateToEvent}
        />
      )}

      {allowActivitiesSection && (
        <TurnStatsSection
          totalTurns={totalTurns}
          turnsThisMonth={turnsThisMonth}
          uniqueTheatres={uniqueTheatres}
          statsLoading={statsLoading}
          onViewTurni={onViewTurni}
        />
      )}

      <div data-tutorial="activities">
        <ActivitiesCard
          activitiesCount={activitiesCount}
          onViewActivities={onViewActivities}
        />
      </div>
    </Screen>
  );
}

// === Sub-components ===

function HomeHeader({
  userName,
  userRole,
  newBadgesCount = 0,
  newBadgeTitle,
  onDismissBadgeNotification,
}: {
  userName: string;
  userRole: string;
  newBadgesCount?: number;
  newBadgeTitle?: string;
  onDismissBadgeNotification?: () => void;
}) {
  const [showBadge, setShowBadge] = React.useState(true);
  const [animateBadges, setAnimateBadges] = React.useState(false);
  const hasNewBadges = newBadgesCount > 0;

  React.useEffect(() => {
    if (!hasNewBadges) { setAnimateBadges(false); return; }
    setAnimateBadges(false);
    const raf = requestAnimationFrame(() => setAnimateBadges(true));
    const timer = setTimeout(() => setAnimateBadges(false), 600);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [hasNewBadges, newBadgesCount]);

  return (
    <header className="space-y-4 mobile-hero-reveal">
      <div className="min-w-0">
        <div className="mt-2 flex items-center gap-3">
          <h2 className="min-w-0 flex-1 text-2xl text-white font-semibold leading-tight break-words">
            {userName || 'Profilo'}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Tag size="sm" className="max-w-[42vw] truncate">{userRole}</Tag>
            <NotificationBell
              hasNewBadges={hasNewBadges}
              showBadge={showBadge}
              animateBadges={animateBadges}
              newBadgeTitle={newBadgeTitle}
              onDismiss={() => {
                setShowBadge(false);
                onDismissBadgeNotification?.();
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function NotificationBell({
  hasNewBadges,
  showBadge,
  animateBadges,
  newBadgeTitle,
  onDismiss,
}: {
  hasNewBadges: boolean;
  showBadge: boolean;
  animateBadges: boolean;
  newBadgeTitle?: string;
  onDismiss: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center size-[44px] rounded-lg hover:bg-[--color-bg-surface-elevated] transition mobile-card-hover">
          <Bell size={20} className="text-[--color-gold-400]" />
          {hasNewBadges && (
            <span className={`absolute -top-1 -right-1 w-3 h-3 bg-[--color-gold-400] rounded-full ${animateBadges ? 'mobile-badge-pop' : ''}`} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 bg-[--color-bg-surface] border-[--color-border-subtle] p-3">
        {showBadge && hasNewBadges ? (
          <div className={`flex items-start gap-3 ${animateBadges ? 'mobile-badge-pop' : ''}`}>
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[--color-gold-400] to-[--color-gold-500] rounded-lg flex items-center justify-center mobile-pulse-once">
              <Award className="text-[--color-bg-primary]" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[--color-gold-400] mb-1 font-semibold">Nuovo titolo ottenuto</p>
              <p className="text-white text-sm">{newBadgeTitle ?? 'Hai sbloccato un nuovo badge'}</p>
            </div>
            <button onClick={onDismiss} className="text-[--color-text-tertiary] p-1 hover:text-white flex-shrink-0 transition-colors">
              <X size={16} />
            </button>
          </div>
        ) : (
          <p className="text-[--color-text-secondary] text-sm text-center py-4">Nessuna notifica</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatsGrid({
  level,
  xp,
  xpToNextLevel,
  reputation,
}: {
  level: number;
  xp: number;
  xpToNextLevel: number;
  reputation: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricTile
        label="Livello"
        value={level}
        helper={`${xp} / ${xpToNextLevel} XP`}
        icon={<TrendingUp size={16} />}
        progress={{ value: xp, max: xpToNextLevel, color: 'gold' }}
        animateOnMount
      />
      <MetricTile
        label="Reputazione ATCL"
        value={reputation}
        progress={{ value: reputation, max: 100, color: 'gold' }}
      />
    </div>
  );
}

function EconomyCard({ cachet, tokenAtcl }: { cachet: number; tokenAtcl: number }) {
  return (
    <Card className="bg-[--color-bg-surface] border border-[--color-bg-surface-hover]">
      <h4 className="text-white text-sm font-semibold mb-3">Economia</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[--color-bg-surface-elevated] border border-[--color-border-subtle] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[--color-text-secondary]">Cachet</p>
            <Coins size={14} className="text-[--color-gold-400]" />
          </div>
          <p className="text-white text-lg font-semibold mt-1">{cachet}</p>
        </div>
        <div className="rounded-xl bg-[--color-bg-surface-elevated] border border-[--color-border-subtle] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[--color-text-secondary]">Token ATCL</p>
            <Zap size={14} className={tokenAtcl === 0 ? 'text-[--color-text-tertiary]' : 'text-[--color-gold-400]'} />
          </div>
          <p className={`text-lg font-semibold mt-1 ${tokenAtcl === 0 ? 'text-[--color-text-tertiary]' : 'text-[--color-gold-400]'}`}>{tokenAtcl}</p>
        </div>
      </div>
    </Card>
  );
}

function TurnSyncFeedbackCard({
  feedback,
  onDismiss,
}: {
  feedback?: TurnSyncFeedback | null;
  onDismiss?: () => void;
}) {
  if (!feedback || (!feedback.boostRequested && feedback.syncStatus !== 'failed_boost_fallback' && feedback.geolocationAvailable !== false)) return null;

  const message =
    feedback.syncStatus === 'synced' && feedback.boostApplied ? 'Boost confermato'
    : feedback.syncStatus === 'failed_boost_fallback' ? 'Boost non applicato (fallback base)'
    : feedback.syncStatus === 'synced_duplicate' ? 'Turno già sincronizzato'
    : 'Richiesta boost in verifica';

  const showGeolocationWarning = feedback.geolocationAvailable === false;

  return (
    <Card className="bg-[--color-bg-surface-elevated] border border-[--color-border-subtle]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-white">{message}</p>
          <p className="text-xs text-[--color-text-secondary]">{feedback.eventName}</p>
          {showGeolocationWarning && (
            <p className="text-xs text-[--color-gold-400] mt-2">
              ⚠️ Turno registrato senza geolocalizzazione. Abilita il GPS per una validazione più accurata in futuro.
            </p>
          )}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-[--color-text-tertiary] hover:text-white transition-colors p-1" aria-label="Chiudi notifica boost">
            <X size={16} />
          </button>
        )}
      </div>
    </Card>
  );
}

function RoleJourneyCard({
  journey,
  onOpen,
}: {
  journey: RoleJourneyData;
  onOpen: () => void;
}) {
  return (
    <Card className="animate-stagger-2 border border-[--color-gold-400]/30 bg-gradient-to-br from-[--color-bg-surface] via-[--color-bg-surface] to-[--color-bg-primary]">
      <div className="space-y-3">
        {journey.eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[--color-gold-400]">{journey.eyebrow}</p>
        )}
        <div className="space-y-1">
          <h3 className="text-white text-lg font-semibold">{journey.headline}</h3>
          <p className="text-sm text-[--color-text-secondary]">{journey.summary}</p>
          {journey.homeMessage && <p className="text-xs text-[--color-gold-400]">{journey.homeMessage}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {journey.recommendedActivityTitle && (
            <Tag size="sm" variant="success">Missione chiave: {journey.recommendedActivityTitle}</Tag>
          )}
          {(journey.starterBadgeLabels ?? []).map(label => (
            <Tag key={label} size="sm" variant="outline">{label}</Tag>
          ))}
        </div>
        {(journey.objectives ?? []).length > 0 && (
          <div className="space-y-2">
            {(journey.objectives ?? []).slice(0, 3).map(objective => (
              <p key={objective} className="text-sm text-[--color-text-primary]">&bull; {objective}</p>
            ))}
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={onOpen}>
          {journey.ctaLabel ?? 'Apri il percorso'}
        </Button>
      </div>
    </Card>
  );
}

function UpcomingEventSection({
  eventState,
  upcomingEvent,
  totalTurns,
  allowScanQr,
  onScanQR,
  onViewTurni,
  onViewEventDetails,
  onNavigateToEvent,
}: {
  eventState: EventState;
  upcomingEvent?: GameEvent;
  totalTurns: number;
  allowScanQr: boolean;
  onScanQR: () => void;
  onViewTurni: () => void;
  onViewEventDetails: () => void;
  onNavigateToEvent: () => void;
}) {
  return (
    <section className="animate-stagger-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-base font-semibold tracking-tight">Prossimo evento</h3>
        {eventState === 'ready' && (
          <button onClick={onViewEventDetails} className="text-sm text-[--color-gold-400] hover:text-[--color-gold-500] px-3 py-2 rounded-lg transition-colors">
            Dettagli
          </button>
        )}
      </div>

      <Card hoverable={eventState === 'ready'} onClick={eventState === 'ready' ? onViewTurni : undefined} animateOnMount>
        {eventState === 'loading' ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : eventState === 'error' ? (
          <div className="space-y-2">
            <p className="text-white">Errore nel caricamento</p>
            <p className="text-sm text-[--color-text-secondary]">Controlla la connessione e riprova.</p>
            <Button variant="secondary" size="sm" onClick={onViewTurni}>Riprova</Button>
          </div>
        ) : eventState === 'empty' ? (
          <div className="space-y-3">
            <p className="text-white">Nessun evento in programma</p>
            <p className="text-sm text-[--color-text-secondary]">Aggiungi un evento o registra un biglietto.</p>
            <div className="flex gap-2">
              {allowScanQr && <Button variant="secondary" size="sm" onClick={onScanQR}>Registra Biglietto</Button>}
              <Button variant="ghost" size="sm" onClick={onViewTurni}>Vedi turni</Button>
            </div>
          </div>
        ) : (
          <EventCard
            event={upcomingEvent!}
            totalTurns={totalTurns}
            onNavigate={onNavigateToEvent}
            onViewTurni={onViewTurni}
          />
        )}
      </Card>
    </section>
  );
}

function EventCard({
  event,
  totalTurns,
  onNavigate,
  onViewTurni,
}: {
  event: GameEvent;
  totalTurns: number;
  onNavigate: () => void;
  onViewTurni: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 bg-[--color-bg-surface-elevated] rounded-lg flex flex-col items-center justify-center w-[70px] h-[70px] gap-1">
          <Calendar className="text-[--color-gold-400] block" size={50} />
          <p className="text-xs leading-none text-[--color-gold-400] !m-0">{event.date?.slice(0, 6)}</p>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white text-lg leading-tight line-clamp-2">{event.name}</h4>
          <p className="text-sm text-[--color-text-secondary]">{event.theatre} &middot; {event.time}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Tag size="sm" variant="outline" className="p-1">{event.genre ?? 'ATCL'}</Tag>
            <Badge variant="default" size="sm">Turni {totalTurns}</Badge>
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="default" size="sm" className="flex-1 justify-center min-h-[44px]" onClick={onNavigate}>
          <Navigation size={16} /> Naviga
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 justify-center min-h-[44px]" onClick={onViewTurni}>
          <CalendarPlus size={16} /> Aggiungi
        </Button>
      </div>
    </div>
  );
}

function TurnStatsSection({
  totalTurns,
  turnsThisMonth,
  uniqueTheatres,
  statsLoading,
  onViewTurni,
}: {
  totalTurns: number;
  turnsThisMonth: number;
  uniqueTheatres: number;
  statsLoading: boolean;
  onViewTurni: () => void;
}) {
  return (
    <section className="animate-stagger-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-base font-semibold tracking-tight">Turni ATCL</h3>
        <button onClick={onViewTurni} className="text-sm text-[--color-gold-400] hover:text-[--color-gold-500] px-3 py-2 rounded-lg transition-colors">
          Vedi tutti
        </button>
      </div>
      <Card>
        {statsLoading ? (
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <MetricTile label="Totale turni" value={totalTurns} onClick={onViewTurni} />
            <MetricTile label="Mese" value={turnsThisMonth} onClick={onViewTurni} />
            <MetricTile label="Teatri diversi" value={uniqueTheatres} onClick={onViewTurni} />
          </div>
        )}
      </Card>
    </section>
  );
}

function ActivitiesCard({
  activitiesCount,
  onViewActivities,
}: {
  activitiesCount: number;
  onViewActivities: () => void;
}) {
  return (
    <section className="animate-stagger-5 space-y-3">
      <h3 className="text-white text-base font-semibold tracking-tight">Attività simulate</h3>
      <Card hoverable onClick={onViewActivities} className="mb-5">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[--color-burgundy-600] to-[--color-burgundy-800] rounded-xl flex items-center justify-center">
            <Play className="text-[--color-gold-400]" size={24} />
          </div>
          <div className="flex-1">
            <h4 className="text-white mb-1">{activitiesCount} attività disponibili</h4>
          </div>
          <ChevronRight className="text-[--color-text-tertiary]" size={20} />
        </div>
      </Card>
    </section>
  );
}
