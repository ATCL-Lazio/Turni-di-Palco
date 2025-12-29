import React, { useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { MapPin, Calendar, Clock, TrendingUp, Award, Coins, CheckCircle2 } from 'lucide-react';
import { GameEvent, Role, RoleId, computeTurnRewards } from '../../state/store';

interface EventConfirmationProps {
  event?: GameEvent;
  role?: Role;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EventConfirmation({ event, role, onConfirm, onCancel }: EventConfirmationProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const roleId = (role?.id ?? 'attore') as RoleId;

  const resolvedRewards = useMemo(() => {
    if (!event) return { xp: 0, reputation: 0, cachet: 0 };
    return computeTurnRewards(event, roleId);
  }, [event, roleId]);

  const resolvedEvent = event ?? {
    name: 'Evento non trovato',
    theatre: 'N/D',
    date: '',
    time: '',
    genre: '',
  };

  const handleConfirm = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onConfirm();
    }, 1500);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen app-gradient flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-[#52c41a] to-[#389e0d] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle2 className="text-white" size={48} />
          </div>

          <h2 className="text-white mb-3">Turno registrato!</h2>
          <p className="text-[#b8b2b3] mb-8">Complimenti! Il tuo turno è stato registrato con successo.</p>

          <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20] mb-6">
            <h4 className="text-[#f4bf4f] mb-4">Ricompense guadagnate</h4>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="text-[#0f0d0e]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{resolvedRewards.xp}</p>
                <p className="text-xs text-[#b8b2b3]">XP</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Award className="text-[#f4bf4f]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{resolvedRewards.reputation}</p>
                <p className="text-xs text-[#b8b2b3]">Reputazione</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-[#241f20] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Coins className="text-[#f4bf4f]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{resolvedRewards.cachet}</p>
                <p className="text-xs text-[#b8b2b3]">Cachet</p>
              </div>
            </div>
          </Card>

          <p className="text-sm text-[#b8b2b3]">Reindirizzamento alla home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-gradient pb-24">
      <div className="bg-gradient-to-b from-[#2d0a0f] to-[#0f0d0e] p-6 pb-8">
        <div className="max-w-md mx-auto">
          <h2 className="text-white mb-2">Conferma turno</h2>
          <p className="text-[#b8b2b3]">Verifica i dettagli dell'evento</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        <Card>
          <div className="mb-4">
            <h3 className="text-white mb-1">{resolvedEvent.name}</h3>
            {resolvedEvent.genre ? <Badge variant="default" size="sm">{resolvedEvent.genre}</Badge> : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <MapPin size={18} className="text-[#f4bf4f]" />
              <span>{resolvedEvent.theatre}</span>
            </div>

            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Calendar size={18} className="text-[#f4bf4f]" />
              <span>{resolvedEvent.date}</span>
            </div>

            <div className="flex items-center gap-3 text-[#b8b2b3]">
              <Clock size={18} className="text-[#f4bf4f]" />
              <span>{resolvedEvent.time}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-white mb-1">Ruolo registrato</h4>
              <p className="text-sm text-[#b8b2b3]">{role?.focus ?? 'Selezionato in fase di registrazione'}</p>
            </div>
            <Badge variant="outline" size="md">
              {role?.name ?? 'Ruolo'}
            </Badge>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <h4 className="text-[#f4bf4f] mb-4">Ricompense previste</h4>

          <div className="flex items-center justify-around">
            <div className="text-center">
              <TrendingUp className="text-[#f4bf4f] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{resolvedRewards.xp}</p>
              <p className="text-xs text-[#b8b2b3]">XP</p>
            </div>

            <div className="text-center">
              <Award className="text-[#f4bf4f] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{resolvedRewards.reputation}</p>
              <p className="text-xs text-[#b8b2b3]">Reputazione</p>
            </div>

            <div className="text-center">
              <Coins className="text-[#f4bf4f] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{resolvedRewards.cachet}</p>
              <p className="text-xs text-[#b8b2b3]">Cachet</p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button variant="primary" size="lg" fullWidth onClick={handleConfirm}>
            Conferma turno
          </Button>

          <Button variant="ghost" size="lg" fullWidth onClick={onCancel}>
            Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}
