import React from 'react';
import { ArrowLeft, Award, MapPin, Theater } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Screen, ScreenHeader } from '../ui/Screen';
import { Card } from '../ui/Card';
import type { Badge } from '../../state/store';

interface TitoliOttenutiProps {
  badges: Badge[];
  onBack: () => void;
  onViewed?: () => void;
}

const BADGE_ICONS: Record<string, LucideIcon> = { Award, MapPin, Theater };

export function TitoliOttenuti({ badges, onBack, onViewed }: TitoliOttenutiProps) {
  React.useEffect(() => {
    onViewed?.();
  }, [onViewed]);

  return (
    <Screen
      header={(
        <ScreenHeader gradient={false}>
          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
              aria-label="Indietro"
            >
              <ArrowLeft size={24} />
            </button>
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-white mb-2">Titoli ottenuti</h2>
            <p className="text-[#b8b2b3]">Tutti i badge sbloccati finora</p>
          </div>
        </ScreenHeader>
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        {badges.map((badge) => {
          const Icon = BADGE_ICONS[badge.icon] ?? Award;
          return (
            <Card key={badge.id} className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 bg-[#f4bf4f] rounded-2xl flex items-center justify-center">
                <Icon className="text-[#0f0d0e]" size={24} />
              </div>
              <p className="text-xs leading-snug text-[#b8b2b3]">{badge.title}</p>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
