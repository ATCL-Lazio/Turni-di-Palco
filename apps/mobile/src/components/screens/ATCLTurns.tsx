import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ScanQRCard } from '../ScanQRCard';
import { QrCode, MapPin, Calendar, TrendingUp, Theater, Bookmark, Map, Award } from 'lucide-react';
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

  const sortedEvents = useMemo(() => {
    const now = new Date();
    return [...events].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      
      // Eventi futuri prima, in ordine cronologico
      if (dateA >= now && dateB >= now) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // Eventi passati dopo, in ordine decrescente (piÃ¹ recenti prima)
      if (dateA < now && dateB < now) {
        return dateB.getTime() - dateA.getTime();
      }
      
      // Futuri prima dei passati
      return dateA >= now ? -1 : 1;
    });
  }, [events]);

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <div className="w-full app-content px-6 space-y-6 pt-6 pb-8">
        <div>
          <h2 className="text-white mb-2">Eventi ATCL</h2>
          <p className="text-[#aeaeb2]">Tutti gli eventi disponibili</p>
        </div>

        <ScanQRCard onScanQR={onScanQR} />

        <Card>
          <h4 className="text-white mb-4">Statistiche totali</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#0a84ff] to-[#004ea8] rounded-lg flex items-center justify-center mx-auto mb-2">
                <Theater className="text-[#0a84ff]" size={20} />
              </div>
              <p className="text-2xl text-white mb-1">{stats.totalTurns}</p>
              <p className="text-xs text-[#aeaeb2]">Eventi totali</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#0066d6] to-[#0a84ff] rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#000000]" size={20} />
              </div>
              <p className="text-2xl text-[#0a84ff] mb-1">{stats.totalXp}</p>
              <p className="text-xs text-[#aeaeb2]">XP potenziali</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-[#2c2c2e] rounded-lg flex items-center justify-center mx-auto mb-2">
                <MapPin className="text-[#0a84ff]" size={20} />
              </div>
              <p className="text-2xl text-white mb-1">{stats.theatreCount}</p>
              <p className="text-xs text-[#aeaeb2]">Teatri</p>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-white">Eventi disponibili</h3>
          <button
            type="button"
            onClick={onViewMap}
            className="flex shrink-0 items-center gap-2 text-sm text-[#0a84ff] hover:text-[#0066d6] px-3 py-[12px] rounded-lg"
            aria-label="Vedi mappa eventi"
          >
            <Map size={16} />
            Mappa
          </button>
        </div>

        {sortedEvents.length > 0 ? (
          <div className="space-y-4">
            {sortedEvents.map((evento) => (
              <Card
                key={evento.id}
                hoverable
                onClick={() => onViewEvent(evento.id)}
                className="border border-white/5 bg-gradient-to-br from-[#1c1c1e] via-[#1d1819] to-[#231e1f]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#004ea8] flex items-center justify-center shadow-[0_8px_20px_rgba(168,40,71,0.25)]">
                    <Theater className="text-[#0a84ff]" size={24} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-[#aeaeb2]">Evento ATCL</p>
                        <h4 className="text-white text-lg leading-tight">{evento.name}</h4>
                      </div>
                      <button
                        type="button"
                        aria-label="Segui evento"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleFollow(evento.id);
                        }}
                        className={`flex items-center justify-center size-10 rounded-xl border transition-colors ${isEventFollowed(evento.id)
                            ? 'border-[#0a84ff] text-[#0a84ff] bg-[#0a84ff]/10'
                            : 'border-[#3a3a3c] text-[#8e8e93] hover:text-[#0a84ff]'
                          }`}
                      >
                        <Bookmark size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[#aeaeb2] mt-3">
                      <MapPin size={14} />
                      <span>{evento.theatre}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[#aeaeb2] mt-2">
                      <Calendar size={14} />
                      <span>{evento.date} Â· {evento.time}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {evento.genre ? (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#0a84ff] backdrop-blur">
                          {evento.genre}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                        <TrendingUp size={12} className="text-[#0a84ff]" />
                        +{evento.baseRewards.xp} XP
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                        <Award size={12} className="text-[#0a84ff]" />
                        +{evento.baseRewards.reputation} Rep
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <div className="w-16 h-16 bg-[#2c2c2e] rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="text-[#8e8e93]" size={32} />
            </div>
            <h4 className="text-white mb-2">Nessun evento disponibile</h4>
            <p className="text-[#aeaeb2] mb-6 max-w-xs mx-auto">
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

