import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ScanQRCard } from '../ScanQRCard';
import { QrCode, MapPin, Calendar, TrendingUp, Theater, Map as MapIcon, Award, Pencil, X } from 'lucide-react';
import { EventPlanning, GameEvent, Role } from '../../state/store';
import { AtclPromoBanner } from '../AtclPromoBanner';
import { useAtclPromotion } from '../../hooks/useAtclPromotion';
import { AtclNewsTicker } from '../AtclNewsTicker';
import { useAtclNewsTicker } from '../../hooks/useAtclNewsTicker';

interface ATCLTurnsProps {
  events: GameEvent[];
  roles: Role[];
  getEventPlan: (eventId: string) => EventPlanning | null;
  onPlanEvent: (eventId: string) => void;
  onCancelPlanning: (eventId: string) => void;
  onEditPlanning: (eventId: string) => void;
  onViewEvent: (eventId: string) => void;
  onViewMap: () => void;
  onScanQR: () => void;
  canScanQr?: boolean;
  embedded?: boolean;
}

export function ATCLTurns({
  events,
  roles,
  getEventPlan,
  onPlanEvent,
  onCancelPlanning,
  onEditPlanning,
  onViewEvent,
  onViewMap,
  onScanQR,
  canScanQr = true,
  embedded = false,
}: ATCLTurnsProps) {
  const roleLabelById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles]
  );

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

      if (dateA >= now && dateB >= now) {
        return dateA.getTime() - dateB.getTime();
      }

      if (dateA < now && dateB < now) {
        return dateB.getTime() - dateA.getTime();
      }

      return dateA >= now ? -1 : 1;
    });
  }, [events]);

  const turnsPromotion = useAtclPromotion('turns');
  const turnsTickerItems = useAtclNewsTicker(18);
  const showTurnsTicker = turnsTickerItems.length > 1;

  const content = (
    <div className={embedded ? 'space-y-6' : 'w-full app-content px-6 space-y-6 pt-6 pb-8'}>
      <div>
        <h2 className="text-white mb-2">Eventi ATCL</h2>
        <p className="text-[--color-text-secondary]">Tutti gli eventi disponibili</p>
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
            <div className="w-10 h-10 bg-gradient-to-br from-[--color-burgundy-600] to-[--color-burgundy-800] rounded-lg flex items-center justify-center mx-auto mb-2">
              <Theater className="text-[--color-gold-400]" size={20} />
            </div>
            <p className="text-2xl text-white mb-1">{stats.totalTurns}</p>
            <p className="text-xs text-[--color-text-secondary]">Eventi totali</p>
          </div>
          <div>
            <div className="w-10 h-10 bg-gradient-to-br from-[--color-gold-500] to-[--color-gold-400] rounded-lg flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="text-[--color-bg-primary]" size={20} />
            </div>
            <p className="text-2xl text-[--color-gold-400] mb-1">{stats.totalXp}</p>
            <p className="text-xs text-[--color-text-secondary]">XP potenziali</p>
          </div>
          <div>
            <div className="w-10 h-10 bg-[--color-bg-surface-elevated] rounded-lg flex items-center justify-center mx-auto mb-2">
              <MapPin className="text-[--color-gold-400]" size={20} />
            </div>
            <p className="text-2xl text-white mb-1">{stats.theatreCount}</p>
            <p className="text-xs text-[--color-text-secondary]">Teatri</p>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-white">Eventi disponibili</h3>
        <button
          type="button"
          onClick={onViewMap}
          className="flex shrink-0 items-center gap-2 text-sm text-[--color-gold-400] hover:text-[--color-gold-500] px-3 py-[12px] rounded-lg"
          aria-label="Vedi mappa eventi"
        >
          <MapIcon size={16} />
          Mappa
        </button>
      </div>

      {sortedEvents.length > 0 ? (
        <div className="space-y-4">
          {sortedEvents.map((event) => {
            const planning = getEventPlan(event.id);
            const roleLabel = planning ? roleLabelById.get(planning.roleId) ?? planning.roleId : null;
            const statusLabel = planning ? getPlanningStatusLabel(planning.status) : 'Da pianificare';
            const statusClassName = planning
              ? getPlanningStatusClassName(planning.status)
              : 'border-white/10 bg-white/5 text-[--color-text-secondary]';

            return (
              <Card
                key={event.id}
                hoverable
                onClick={() => onViewEvent(event.id)}
                className="border border-white/5 bg-gradient-to-br from-[--color-bg-surface] via-[--color-bg-surface-dim] to-[--color-bg-elevated-alt]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[--color-burgundy-600] to-[--color-burgundy-800] flex items-center justify-center shadow-[0_8px_20px_rgba(168,40,71,0.25)]">
                    <Theater className="text-[--color-gold-400]" size={24} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-[--color-text-secondary]">Evento ATCL</p>
                        <h4 className="text-white text-lg leading-tight">{event.name}</h4>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium ${statusClassName}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[--color-text-secondary] mt-3">
                      <MapPin size={14} />
                      <span>{event.theatre}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[--color-text-secondary] mt-2">
                      <Calendar size={14} />
                      <span>{event.date} · {event.time}</span>
                    </div>

                    {roleLabel ? (
                      <p className="mt-3 text-sm text-[--color-gold-400]">
                        Ruolo pianificato: <span className="text-white">{roleLabel}</span>
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-[--color-text-secondary]">
                        Apri il dettaglio evento per scegliere un ruolo e salvare la pianificazione.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                      {event.genre ? (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-[--color-gold-400] backdrop-blur">
                          {event.genre}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                        <TrendingUp size={12} className="text-[--color-gold-400]" />
                        +{event.baseRewards.xp} XP
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                        <Award size={12} className="text-[--color-gold-400]" />
                        +{event.baseRewards.reputation} Rep
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button
                        variant={planning ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={(nextEvent) => {
                          nextEvent.stopPropagation();
                          if (planning) {
                            onEditPlanning(event.id);
                            return;
                          }
                          onPlanEvent(event.id);
                        }}
                      >
                        {planning ? <Pencil size={14} /> : null}
                        {planning ? 'Modifica' : 'Pianifica'}
                      </Button>
                      {planning ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(nextEvent) => {
                            nextEvent.stopPropagation();
                            onCancelPlanning(event.id);
                          }}
                        >
                          <X size={14} />
                          Cancella
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <div className="w-16 h-16 bg-[--color-bg-surface-elevated] rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="text-[--color-text-tertiary]" size={32} />
          </div>
          <h4 className="text-white mb-2">Nessun evento disponibile</h4>
          <p className="text-[--color-text-secondary] mb-6 max-w-xs mx-auto">
            Torna piu tardi o aggiorna la lista eventi.
          </p>
          {canScanQr ? (
            <Button variant="primary" onClick={onScanQR}>
              <QrCode size={18} />
              Registra Biglietto
            </Button>
          ) : null}
        </Card>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {content}
    </div>
  );
}

function getPlanningStatusLabel(status: EventPlanning['status']) {
  switch (status) {
    case 'confirmed':
      return 'Confermato';
    case 'cancelled':
      return 'Annullato';
    default:
      return 'Pianificato';
  }
}

function getPlanningStatusClassName(status: EventPlanning['status']) {
  switch (status) {
    case 'confirmed':
      return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300';
    case 'cancelled':
      return 'border-white/10 bg-white/5 text-[--color-text-secondary]';
    default:
      return 'border-[--color-gold-400]/40 bg-[--color-gold-400]/10 text-[--color-gold-400]';
  }
}
