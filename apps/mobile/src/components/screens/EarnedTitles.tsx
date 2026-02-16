import React from 'react';
import { ArrowLeft, Award, MapPin, Theater } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Screen } from '../ui/Screen';
import { Card } from '../ui/Card';
import type { Badge } from '../../state/store';

interface EarnedTitlesProps {
  badges: Badge[];
  onBack: () => void;
  onViewed?: () => void;
}

const BADGE_ICONS: Record<string, LucideIcon> = { Award, MapPin, Theater };

export function EarnedTitles({ badges, onBack, onViewed }: EarnedTitlesProps) {
  React.useEffect(() => {
    onViewed?.();
  }, [onViewed]);

  return (
    <Screen
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 space-y-0 box-border"
    >
      <div className="flex flex-col">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#0a84ff]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4">
          <h2 className="text-white mb-2">Titoli ottenuti</h2>
          <p className="text-[#aeaeb2]">Tutti i badge sbloccati finora</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          {badges.map((badge) => {
            const Icon = BADGE_ICONS[badge.icon] ?? Award;
            return (
              <Card key={badge.id} className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 bg-[#0a84ff] rounded-2xl flex items-center justify-center">
                  <Icon className="text-[#000000]" size={24} />
                </div>
                <p className="text-xs leading-snug text-[#aeaeb2]">{badge.title}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}

