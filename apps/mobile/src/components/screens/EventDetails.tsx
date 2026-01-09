import React from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Calendar, Clock, MapPin, Navigation } from 'lucide-react';
import { GameEvent } from '../../state/store';

type EventDetailsProps = {
  event?: GameEvent;
  onBack: () => void;
  onNavigate: () => void;
};

export function EventDetails({ event, onBack, onNavigate }: EventDetailsProps) {
  if (!event) {
    return (
      <div className="min-h-screen">
        <div className="app-content px-6 space-y-6 pt-6">
          <div>
            <h2 className="text-white mb-2">Dettagli evento</h2>
            <p className="text-[#b8b2b3]">Nessun evento disponibile.</p>
          </div>
          <Button variant="ghost" size="lg" fullWidth onClick={onBack}>
            Torna indietro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="app-content px-6 space-y-6 pt-6">
        <div>
          <h2 className="text-white mb-2">Dettagli evento</h2>
          <p className="text-[#b8b2b3]">Informazioni sull'evento selezionato</p>
        </div>

        <Card>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-white text-lg leading-tight">{event.name}</h3>
              {event.genre ? <Badge variant="default" size="sm">{event.genre}</Badge> : null}
            </div>
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <MapPin size={18} className="text-[#f4bf4f]" />
              <span>{event.theatre}</span>
            </div>
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Calendar size={18} className="text-[#f4bf4f]" />
              <span>{event.date}</span>
            </div>
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Clock size={18} className="text-[#f4bf4f]" />
              <span>{event.time}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <h4 className="text-[#f4bf4f] mb-4">Ricompense base</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-white text-lg">+{event.baseRewards.xp}</p>
              <p className="text-xs text-[#b8b2b3]">XP</p>
            </div>
            <div>
              <p className="text-white text-lg">+{event.baseRewards.reputation}</p>
              <p className="text-xs text-[#b8b2b3]">Reputazione</p>
            </div>
            <div>
              <p className="text-white text-lg">+{event.baseRewards.cachet}</p>
              <p className="text-xs text-[#b8b2b3]">Cachet</p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button variant="secondary" size="lg" fullWidth onClick={onNavigate}>
            <Navigation size={16} className="text-white" />
            Naviga
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={onBack}>
            Torna indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
