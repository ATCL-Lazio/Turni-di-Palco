import React from 'react';
import { ArrowLeft, Award, Calendar, Lock, MapPin, Theater } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { Badge, TurnStats } from '../../state/store';

interface EarnedTitlesProps {
  badges: Badge[];
  turnStats: TurnStats;
  onBack: () => void;
  onViewed?: () => void;
}

const BADGE_ICONS: Record<string, LucideIcon> = { Award, MapPin, Theater, Calendar };

function getBadgeGlyph(badge: Badge) {
  if (badge.icon === 'Developer' || badge.icon === 'developer_prompt') return '>_';
  return null;
}

function getBadgeProgressMeta(badge: Badge, turnStats: TurnStats) {
  if (!badge.metric || badge.metric === 'manual' || badge.threshold == null) return null;

  const current =
    badge.metric === 'total_turns'
      ? turnStats.totalTurns
      : badge.metric === 'turns_this_month'
        ? turnStats.turnsThisMonth
        : badge.metric === 'unique_theatres'
          ? turnStats.uniqueTheatres
          : null;

  if (current == null) return null;

  const unit =
    badge.metric === 'unique_theatres'
      ? 'teatri'
      : badge.metric === 'turns_this_month'
        ? 'turni nel mese'
        : 'turni';

  const safeCurrent = Math.min(current, badge.threshold);

  return {
    current: safeCurrent,
    target: badge.threshold,
    unit,
    label: `${safeCurrent}/${badge.threshold} ${unit}`,
  };
}

export function EarnedTitles({ badges, turnStats, onBack, onViewed }: EarnedTitlesProps) {
  React.useEffect(() => {
    onViewed?.();
  }, [onViewed]);

  const visibleBadges = React.useMemo(
    () =>
      [...badges]
        .filter((badge) => badge.unlocked || !badge.isHidden)
        .sort(
          (left, right) =>
            Number(right.unlocked) - Number(left.unlocked) || left.title.localeCompare(right.title, 'it')
        ),
    [badges]
  );

  return (
    <Screen
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 space-y-0 box-border"
    >
      <div className="flex flex-col">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4">
          <h2 className="text-white">Titoli ottenuti</h2>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleBadges.map((badge) => {
            const glyph = getBadgeGlyph(badge);
            const Icon = glyph ? null : BADGE_ICONS[badge.icon] ?? Award;
            const progress = getBadgeProgressMeta(badge, turnStats);
            return (
              <Card
                key={badge.id}
                className={`flex items-start gap-4 border ${
                  badge.unlocked ? 'border-[#f4bf4f]/20' : 'border-[#3d3a3b] opacity-80'
                } ${badge.isHidden ? 'secret-badge-frame' : ''}`}
                style={badge.unlocked ? undefined : { backgroundColor: '#161314' }}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    badge.unlocked
                      ? 'bg-[#f4bf4f]'
                      : 'bg-[#2a2526]'
                  } ${badge.isHidden ? 'secret-badge-shimmer' : ''}`}
                >
                  {glyph ? (
                    <span
                      className={`font-mono text-[16px] leading-none font-bold tracking-[-0.08em] ${
                        badge.unlocked ? 'text-[#0f0d0e]' : 'text-[#7a7577]'
                      } relative z-[1]`}
                    >
                      {glyph}
                    </span>
                  ) : (
                    <Icon className={`${badge.unlocked ? 'text-[#0f0d0e]' : 'text-[#7a7577]'} relative z-[1]`} size={24} />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={`text-sm leading-snug ${badge.unlocked ? 'text-[#f7f3f4]' : 'text-[#b8b2b3]'}`}>
                    {badge.title}
                  </p>
                  {badge.description ? (
                    <p className="text-xs leading-snug text-[#9b9496]">{badge.description}</p>
                  ) : null}
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7a7577]">
                    {badge.unlocked ? 'Sbloccato' : (
                      <span className="inline-flex items-center gap-1">
                        <Lock size={10} />
                        Bloccato
                      </span>
                    )}
                  </p>
                  {badge.isHidden ? (
                    <p className="secret-badge-label text-[10px] font-medium uppercase tracking-[0.14em] text-[#f4bf4f]">
                      Badge segreto
                    </p>
                  ) : null}
                  {progress && !badge.unlocked ? (
                    <div className="pt-1 space-y-2">
                      <div className="flex items-center justify-between gap-3 text-[11px] text-[#b8b2b3]">
                        <span>In corso</span>
                        <span className="text-[#9b9496]">
                          {progress.label}
                        </span>
                      </div>
                      <ProgressBar
                        value={progress.current}
                        max={progress.target}
                        size="sm"
                        color="burgundy"
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#b8b2b3]">
                      {badge.unlocked ? 'Obiettivo completato' : 'Obiettivo in arrivo'}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {!visibleBadges.length ? (
          <p className="mt-6 text-sm text-[#7a7577]">Nessun badge disponibile in questo momento.</p>
        ) : null}
      </div>
    </Screen>
  );
}
