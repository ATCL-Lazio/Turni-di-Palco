import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ScanQRCard } from '../ScanQRCard';
import { QrCode, MapPin, Calendar, TrendingUp, Theater, Bookmark, Map } from 'lucide-react';
import { GameEvent } from '../../state/store';

interface ATCLTurnsProps {
  events: GameEvent[];
  isEventFollowed: (eventId: string) => boolean;
  onToggleFollow: (eventId: string) => void;
  onViewEvent: (eventId: string) => void;
  onViewMap: () => void;
  onScanQR: () => void;
}

export function ATCLTurns({
  events,
  isEventFollowed,
  onToggleFollow,
  onViewEvent,
  onViewMap,
  onScanQR,
}: ATCLTurnsProps) {
  const stats = useMemo(() => {
    const totalXp = events.reduce((acc, event) => acc + event.baseRewards.xp, 0);
    const theatreCount = new Set(events.map((event) => event.theatre)).size;
    const totalTurns = events.length;
    return { totalXp, theatreCount, totalTurns };
  }, [events]);

  const sortedEvents = useMemo(() => [...events], [events]);

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <div className="w-full app-content px-6 space-y-6 pt-6 pb-8">
        <div>
          <h2 className="text-white mb-2">Eventi ATCL</h2>
          <p className="text-[#b8b2b3]">Tutti gli eventi disponibili</p>
        </div>

        <ScanQRCard onScanQR={onScanQR} />

        <Card>
          <h4 className="text-white mb-4">Statistiche totali</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-lg flex items-center justify-center mx-auto mb-2">
                <Theater className="text-[#f4bf4f]" size={20} />
              </div>
              <p className="text-2xl text-white mb-1">{stats.totalTurns}</p>
              <p className="text-xs text-[#b8b2b3]">Eventi totali</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#0f0d0e]" size={20} />
              </div>
              <p className="text-2xl text-[#f4bf4f] mb-1">{stats.totalXp}</p>
              <p className="text-xs text-[#b8b2b3]">XP potenziali</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-[#241f20] rounded-lg flex items-center justify-center mx-auto mb-2">
                <MapPin className="text-[#f4bf4f]" size={20} />
              </div>
              <p className="text-2xl text-white mb-1">{stats.theatreCount}</p>
              <p className="text-xs text-[#b8b2b3]">Teatri</p>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-white">Eventi disponibili</h3>
          <button
            type="button"
            onClick={onViewMap}
            className="flex shrink-0 items-center gap-2 text-sm text-[#f4bf4f] hover:text-[#e6a23c] px-3 py-[12px] rounded-lg"
            aria-label="Vedi mappa eventi"
          >
            <Map size={16} />
            Mappa
          </button>
        </div>

        {sortedEvents.length > 0 ? (
          <div className="space-y-3">
            {sortedEvents.map((evento) => (
              <Card key={evento.id} hoverable onClick={() => onViewEvent(evento.id)}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#241f20] rounded-lg flex items-center justify-center">
                    <Theater className="text-[#f4bf4f]" size={24} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-white mb-1">{evento.name}</h4>
                      <button
                        type="button"
                        aria-label="Segui evento"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleFollow(evento.id);
                        }}
                        className={`flex items-center justify-center size-9 rounded-lg border ${isEventFollowed(evento.id)
                            ? 'border-[#f4bf4f] text-[#f4bf4f]'
                            : 'border-[#2d2728] text-[#7a7577]'
                          }`}
                      >
                        <Bookmark size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mb-2">
                      <MapPin size={14} />
                      <span>{evento.theatre}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mb-3">
                      <Calendar size={14} />
                      <span>{evento.date} - {evento.time}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {evento.genre ? (
                        <Badge variant="outline" size="sm">
                          {evento.genre}
                        </Badge>
                      ) : null}
                      <Badge variant="gold" size="sm">
                        +{evento.baseRewards.xp} XP
                      </Badge>
                      <Badge variant="success" size="sm">
                        +{evento.baseRewards.reputation} Rep
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <div className="w-16 h-16 bg-[#241f20] rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="text-[#7a7577]" size={32} />
            </div>
            <h4 className="text-white mb-2">Nessun evento disponibile</h4>
            <p className="text-[#b8b2b3] mb-6 max-w-xs mx-auto">
              Torna piu tardi o aggiorna la lista eventi.
            </p>
            <Button variant="primary" onClick={onScanQR}>
              <QrCode size={18} />
              Scansiona QR
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
