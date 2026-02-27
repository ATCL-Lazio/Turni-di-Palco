import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ScanQRCard } from '../ScanQRCard';
import { QrCode, MapPin, Calendar, TrendingUp, Theater, Bookmark, Map, Award } from 'lucide-react';
import { GameEvent } from '../../state/store';
import { AtclPromoBanner } from '../AtclPromoBanner';
import { useAtclPromotion } from '../../hooks/useAtclPromotion';
import { AtclNewsTicker } from '../AtclNewsTicker';
import { useAtclNewsTicker } from '../../hooks/useAtclNewsTicker';

interface ATCLTurnsProps {
  events: GameEvent[];
  isEventFollowed: (eventId: string) => boolean;
  onToggleFollow: (eventId: string) => void;
  onViewEvent: (eventId: string) => void;
  onViewMap: () => void;
  onScanQR: () => void;
  canScanQr?: boolean;
}

export function ATCLTurns({
  events,
  isEventFollowed,
  onToggleFollow,
  onViewEvent,
  onViewMap,
  onScanQR,
  canScanQr = true,
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
      
      // Eventi passati dopo, in ordine decrescente (più recenti prima)
      if (dateA < now && dateB < now) {
        return dateB.getTime() - dateA.getTime();
      }
      
      // Futuri prima dei passati
      return dateA >= now ? -1 : 1;
    });
  }, [events]);
  const turnsPromotion = useAtclPromotion('turns');
  const turnsTickerItems = useAtclNewsTicker(18);
  const showTurnsTicker = turnsTickerItems.length > 1;

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

        {canScanQr ? <ScanQRCard onScanQR={onScanQR} /> : null}
        {showTurnsTicker ? (
          <AtclNewsTicker items={turnsTickerItems} />
        ) : turnsPromotion ? (
          <AtclPromoBanner promotion={turnsPromotion} />
        ) : null}

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
          <div className="space-y-4">
            {sortedEvents.map((evento) => (
              <Card
                key={evento.id}
                hoverable
                onClick={() => onViewEvent(evento.id)}
                className="border border-white/5 bg-gradient-to-br from-[#1a1617] via-[#1d1819] to-[#231e1f]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#a82847] to-[#6b1529] flex items-center justify-center shadow-[0_8px_20px_rgba(168,40,71,0.25)]">
                    <Theater className="text-[#f4bf4f]" size={24} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">Evento ATCL</p>
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
                            ? 'border-[#f4bf4f] text-[#f4bf4f] bg-[#f4bf4f]/10'
                            : 'border-[#2d2728] text-[#7a7577] hover:text-[#f4bf4f]'
                          }`}
                      >
                        <Bookmark size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mt-3">
                      <MapPin size={14} />
                      <span>{evento.theatre}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mt-2">
                      <Calendar size={14} />
                      <span>{evento.date} · {evento.time}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {evento.genre ? (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#f4bf4f] backdrop-blur">
                          {evento.genre}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                        <TrendingUp size={12} className="text-[#f4bf4f]" />
                        +{evento.baseRewards.xp} XP
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                        <Award size={12} className="text-[#f4bf4f]" />
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
            <div className="w-16 h-16 bg-[#241f20] rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="text-[#7a7577]" size={32} />
            </div>
            <h4 className="text-white mb-2">Nessun evento disponibile</h4>
            <p className="text-[#b8b2b3] mb-6 max-w-xs mx-auto">
              Torna piu tardi o aggiorna la lista eventi.
            </p>
            {canScanQr ? (
              <Button variant="primary" onClick={onScanQR}>
                <QrCode size={18} />
                Scansiona QR
              </Button>
            ) : null}
          </Card>
        )}
      </div>
    </div>
  );
}
