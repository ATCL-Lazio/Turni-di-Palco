import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { MetricTile } from '../ui/MetricTile';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/Button';
import { Play, Calendar, Award, ChevronRight, Navigation, CalendarPlus, X, Bell, Sparkles } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { GameEvent } from '../../state/store';
import { ScanQRCard } from '../ScanQRCard';

type EventState = 'loading' | 'error' | 'empty' | 'ready';

interface HomeProps {
  userName: string;
  userRole: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  reputation: number;
  totalTurns: number;
  turnsThisMonth: number;
  uniqueTheatres: number;
  newBadgesCount?: number;
  newBadgeTitle?: string;
  onDismissBadgeNotification?: () => void;
  upcomingEvent?: GameEvent;
  activitiesCount: number;
  eventLoading?: boolean;
  eventError?: boolean;
  statsLoading?: boolean;
  onScanQR: () => void;
  onViewActivities: () => void;
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
  totalTurns,
  turnsThisMonth,
  uniqueTheatres,
  newBadgesCount = 0,
  newBadgeTitle,
  onDismissBadgeNotification,
  upcomingEvent,
  activitiesCount,
  eventLoading = false,
  eventError = false,
  statsLoading = false,
  onScanQR,
  onViewActivities,
  onViewTurni,
  onViewEventDetails,
  onNavigateToEvent,
}: HomeProps) {
  const xpToNext = Math.max(xpToNextLevel - xp, 0);
  const [showBadge, setShowBadge] = React.useState(true);
  const [animateBadges, setAnimateBadges] = React.useState(false);
  const hasNewBadges = newBadgesCount > 0;
  const xpProgress = xpToNextLevel > 0 ? Math.min(xp / xpToNextLevel, 1) : 0;
  const reputationProgress = Math.min(reputation / 100, 1);

  // Trigger badge animations when component mounts or new badges arrive
  React.useEffect(() => {
    if (!hasNewBadges) {
      setAnimateBadges(false);
      return;
    }

    setAnimateBadges(false);
    const raf = requestAnimationFrame(() => setAnimateBadges(true));
    const timer = setTimeout(() => setAnimateBadges(false), 600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [hasNewBadges, newBadgesCount]);

  const eventState: EventState = eventError ? 'error' : eventLoading ? 'loading' : !upcomingEvent ? 'empty' : 'ready';

  const renderProgressRing = ({
    value,
    max,
    label,
    helper,
    color,
  }: {
    value: number;
    max: number;
    label: string;
    helper: string;
    color: 'gold' | 'burgundy';
  }) => {
    const safeMax = Math.max(max, 1);
    const percentage = Math.min(value / safeMax, 1);
    const radius = 26;
    const stroke = 6;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - percentage * circumference;
    const strokeColor = color === 'gold' ? '#f4bf4f' : '#a82847';
    const trackColor = '#2d2728';

    return (
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center">
          <svg width={64} height={64} className="rotate-[-90deg]">
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke={trackColor}
              strokeWidth={stroke}
              fill="transparent"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              stroke={strokeColor}
              strokeWidth={stroke}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg text-white font-semibold">{value}</span>
            <span className="text-[10px] text-[#b8b2b3]">/ {safeMax}</span>
          </div>
        </div>
        <div>
          <p className="text-sm text-[#b8b2b3]">{label}</p>
          <p className="text-white text-base font-semibold">{helper}</p>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center mobile-hero-reveal"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <div className="w-full app-content px-6 pt-6 pb-8 space-y-6">
        <header className="space-y-5 relative mobile-hero-reveal" style={{ marginBottom: '20px' }}>
          <div className="absolute top-0 right-0">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center size-[44px] rounded-lg hover:bg-[#241f20] transition mobile-card-hover">
                  <Bell size={20} className="text-[#f4bf4f]" />
                  {hasNewBadges && (
                    <span
                      className={`absolute -top-1 -right-1 w-3 h-3 bg-[#f4bf4f] rounded-full ${
                        animateBadges ? 'mobile-badge-pop' : ''
                      }`}
                    />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 bg-[#1a1617] border-[#3d3a3b] p-3">
                {showBadge && hasNewBadges ? (
                  <div className={`flex items-start gap-3 ${animateBadges ? 'mobile-badge-pop' : ''}`}>
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[#f4bf4f] to-[#e6a23c] rounded-lg flex items-center justify-center mobile-pulse-once">
                      <Award className="text-[#0f0d0e]" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-[#f4bf4f] mb-1 font-semibold">Nuovo titolo ottenuto</p>
                      <p className="text-white text-sm">{newBadgeTitle ?? 'Hai sbloccato un nuovo badge'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowBadge(false);
                        onDismissBadgeNotification?.();
                      }}
                      className="text-[#7a7577] p-1 hover:text-white flex-shrink-0 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <p className="text-[#b8b2b3] text-sm text-center py-4">Nessuna notifica</p>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[#b8b2b3]">Benvenuto,</p>
              <h2 className="text-2xl text-white font-semibold leading-tight">{userName || 'Profilo'}</h2>
            </div>
            <Tag size="sm">{userRole}</Tag>
          </div>

          <Card className="border border-[#2d2728] bg-gradient-to-br from-[#1a1617] to-[#231e1f]">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-2xl flex items-center justify-center text-white text-xl font-semibold">
                  {userName?.slice(0, 1) || 'T'}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-[#f4bf4f] text-[#0f0d0e] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Lv {level}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#b8b2b3]">Progressi attuali</p>
                <p className="text-white text-base font-semibold">{xpToNext} XP al prossimo livello</p>
              </div>
              <Sparkles className="text-[#f4bf4f]" size={22} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border border-[#2d2728] bg-[#1a1617]" animateOnMount>
              {renderProgressRing({
                value: xp,
                max: xpToNextLevel,
                label: 'XP livello',
                helper: `${Math.round(xpProgress * 100)}% completato`,
                color: 'gold',
              })}
            </Card>
            <Card className="border border-[#2d2728] bg-[#1a1617]">
              {renderProgressRing({
                value: reputation,
                max: 100,
                label: 'Reputazione',
                helper: `${Math.round(reputationProgress * 100)}% fiducia`,
                color: 'burgundy',
              })}
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#2d2728] bg-[#1a1617] px-3 py-3 text-center">
              <p className="text-xs text-[#b8b2b3]">Turni</p>
              <p className="text-lg text-white font-semibold">{totalTurns}</p>
            </div>
            <div className="rounded-xl border border-[#2d2728] bg-[#1a1617] px-3 py-3 text-center">
              <p className="text-xs text-[#b8b2b3]">Attività</p>
              <p className="text-lg text-white font-semibold">{activitiesCount}</p>
            </div>
            <div className="rounded-xl border border-[#2d2728] bg-[#1a1617] px-3 py-3 text-center">
              <p className="text-xs text-[#b8b2b3]">Teatri</p>
              <p className="text-lg text-white font-semibold">{uniqueTheatres}</p>
            </div>
          </div>
        </header>

        <ScanQRCard onScanQR={onScanQR} className="mt-5" />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-semibold" style={{ margin: '20px 0 5px' }}>Prossimo evento</h3>
            {eventState === 'ready' ? (
              <button
                onClick={onViewEventDetails}
                className="text-sm text-[#f4bf4f] hover:text-[#e6a23c] px-3 py-[12px] rounded-lg"
                style={{ margin: '20px 0 5px' }}
              >
                Dettagli
              </button>
            ) : null}
          </div>

          <Card 
            hoverable={eventState === 'ready'} 
            onClick={eventState === 'ready' ? onViewTurni : undefined}
            animateOnMount
          >
            {eventState === 'loading' ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-40" />
              </div>
            ) : eventState === 'error' ? (
              <div className="space-y-2">
                <p className="text-white">Errore nel caricamento</p>
                <p className="text-sm text-[#b8b2b3]">Controlla la connessione e riprova.</p>
                <Button variant="secondary" size="sm" onClick={onViewTurni}>
                  Riprova
                </Button>
              </div>
            ) : eventState === 'empty' ? (
              <div className="space-y-3">
                <p className="text-white">Nessun evento in programma</p>
                <p className="text-sm text-[#b8b2b3]">Aggiungi un evento o registra un turno dal QR.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={onScanQR}>
                    Scansiona QR
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onViewTurni}>
                    Vedi turni
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-3" style={{ marginBottom: '20px' }}>
                  <div className="flex-shrink-0 bg-[#241f20] rounded-lg flex flex-col items-center justify-center w-[70px] h-[70px] gap-1">
                    <Calendar className="text-[#f4bf4f] block" size={50} />
                    <p className="text-xs leading-none text-[#f4bf4f] !m-0">{upcomingEvent?.date?.slice(0, 6)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white text-lg leading-tight line-clamp-2">{upcomingEvent?.name}</h4>
                    <p className="text-sm text-[#b8b2b3]">
                      {upcomingEvent?.theatre} · {upcomingEvent?.time}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Tag size="sm" variant="outline" className="p-1">
                        {upcomingEvent?.genre ?? 'ATCL'}
                      </Tag>
                      <Badge variant="default" size="sm">
                        Turni {totalTurns}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" size="sm" className="flex-1 justify-center min-h-[44px]" onClick={onNavigateToEvent} style={{ backgroundColor: '#a72847' }}>
                    <Navigation size={16} className="text-white" />
                    <div className="text-white">Naviga</div>
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 justify-center min-h-[44px]" onClick={onViewTurni}>
                    <CalendarPlus size={16} />
                    Aggiungi
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-lg font-semibold" style={{ margin: '20px 0 5px' }}>Turni ATCL</h3>
            <button
              onClick={onViewTurni}
              className="text-sm text-[#f4bf4f] hover:text-[#e6a23c] px-3 py-[12px] rounded-lg"
              style={{ marginTop: '20px' }}
            >
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
                <MetricTile label="Questo mese" value={turnsThisMonth} onClick={onViewTurni} />
                <MetricTile label="Teatri diversi" value={uniqueTheatres} onClick={onViewTurni} />
              </div>
            )}
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="text-white text-lg font-semibold" style={{ margin: '20px 0 5px' }}>Attività simulate</h3>
          <Card hoverable onClick={onViewActivities} className="mb-5">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center">
                <Play className="text-[#f4bf4f]" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="text-white mb-1">{activitiesCount} attività disponibili</h4>
                <p className="text-sm text-[#b8b2b3]">Guadagna XP e migliora le tue skill</p>
              </div>
              <ChevronRight className="text-[#7a7577]" size={20} />
            </div>
          </Card>

        </section>
      </div>
    </div>
  );
}
