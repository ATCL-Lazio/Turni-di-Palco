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
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="app-content w-full text-center animate-fade-in">
          <div className="w-24 h-24 bg-gradient-to-br from-[#30d158] to-[#389e0d] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle2 className="text-white" size={48} />
          </div>

          <h2 className="text-white mb-3">Turno registrato!</h2>
          <p className="text-[#aeaeb2] mb-8">Complimenti! Il tuo turno Ã¨ stato registrato con successo.</p>

          <Card className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] mb-6">
            <h4 className="text-[#0a84ff] mb-4">Ricompense guadagnate</h4>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0066d6] to-[#0a84ff] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="text-[#000000]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{resolvedRewards.xp}</p>
                <p className="text-xs text-[#aeaeb2]">XP</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0a84ff] to-[#004ea8] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Award className="text-[#0a84ff]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{resolvedRewards.reputation}</p>
                <p className="text-xs text-[#aeaeb2]">Reputazione</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-[#2c2c2e] rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Coins className="text-[#0a84ff]" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{resolvedRewards.cachet}</p>
                <p className="text-xs text-[#aeaeb2]">Cachet</p>
              </div>
            </div>
          </Card>

          <p className="text-sm text-[#aeaeb2]">Reindirizzamento alla home...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="app-content px-6 space-y-6 pt-6">
        <div>
          <h2 className="text-white mb-2">Conferma turno</h2>
          <p className="text-[#aeaeb2]">Verifica i dettagli dell'evento</p>
        </div>

        <Card>
          <div className="mb-4">
            <h3 className="text-white mb-1">{resolvedEvent.name}</h3>        
            {resolvedEvent.genre ? <Badge variant="default" size="sm">{resolvedEvent.genre}</Badge> : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[#aeaeb2]">
              <MapPin size={18} className="text-[#0a84ff]" />
              <span>{resolvedEvent.theatre}</span>
            </div>

            <div className="flex items-center gap-3 text-[#aeaeb2]">
              <Calendar size={18} className="text-[#0a84ff]" />
              <span>{resolvedEvent.date}</span>
            </div>

            <div className="flex items-center gap-3 text-[#aeaeb2]">
              <Clock size={18} className="text-[#0a84ff]" />
              <span>{resolvedEvent.time}</span>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-white mb-1">Ruolo registrato</h4>
              <p className="text-sm text-[#aeaeb2]">{role?.focus ?? 'Selezionato in fase di registrazione'}</p>
            </div>
            <Badge variant="outline" size="md">
              {role?.name ?? 'Ruolo'}
            </Badge>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e]">
          <h4 className="text-[#0a84ff] mb-4">Ricompense previste</h4>

          <div className="flex items-center justify-around">
            <div className="text-center">
              <TrendingUp className="text-[#0a84ff] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{resolvedRewards.xp}</p>
              <p className="text-xs text-[#aeaeb2]">XP</p>
            </div>

            <div className="text-center">
              <Award className="text-[#0a84ff] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{resolvedRewards.reputation}</p>
              <p className="text-xs text-[#aeaeb2]">Reputazione</p>
            </div>

            <div className="text-center">
              <Coins className="text-[#0a84ff] mx-auto mb-2" size={24} />
              <p className="text-white mb-1">+{resolvedRewards.cachet}</p>
              <p className="text-xs text-[#aeaeb2]">Cachet</p>
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

