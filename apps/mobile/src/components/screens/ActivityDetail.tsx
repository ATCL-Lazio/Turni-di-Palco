import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Play, Clock, TrendingUp, Coins, X, AlertCircle } from 'lucide-react';
import { Activity, ActivityAvailability } from '../../state/store';
import { getMinigameConfig } from '../../gameplay/minigames';

interface ActivityDetailProps {
  activity: Activity;
  availability: ActivityAvailability;
  notice?: string | null;
  onStart: () => void;
  onClose: () => void;
}

export function ActivityDetail({ activity, availability, notice, onStart, onClose }: ActivityDetailProps) {
  const minigame = getMinigameConfig(activity.id);
  const lockMessage =
    availability.reason === 'cooldown'
      ? `Cooldown attivo: attendi ${availability.remainingSeconds}s.`
      : availability.reason === 'session_limit'
        ? `Limite sessione raggiunto (${availability.maxRunsPerSession} run).`
        : null;

  return (
    <div className="fixed inset-0 app-gradient z-50 overflow-y-auto pb-24">
      <div className="sticky top-0 bg-[#1a1617] border-b border-[#2d2728] p-4 flex items-center justify-between z-10">
        <h3 className="text-white">Dettagli attivita</h3>
        <button onClick={onClose} className="flex items-center justify-center size-[44px] hover:bg-[#241f20] rounded-lg transition-colors">
          <X className="text-[#f4bf4f]" size={24} />
        </button>
      </div>

      <div className="app-content px-6 py-6 space-y-6">
        <div>
          <h2 className="text-white mb-2">{activity.title}</h2>
          <div className="flex items-center gap-3">
            <Badge variant="outline" size="md">
              <Clock size={14} />
              {activity.duration}
            </Badge>
            <span className="text-[#b8b2b3]">{activity.difficulty}</span>
            <Badge variant="success" size="sm">
              {availability.runsUsed}/{availability.maxRunsPerSession} run
            </Badge>
          </div>
        </div>

        <Card>
          <h4 className="text-white mb-2">Descrizione</h4>
          <p className="text-[#b8b2b3]">{activity.description}</p>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <h4 className="text-[#f4bf4f] mb-4">Ricompense</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#0f0d0e]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{activity.xpReward}</p>
              <p className="text-xs text-[#b8b2b3]">XP</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-[#241f20] rounded-lg flex items-center justify-center mx-auto mb-2">
                <Coins className="text-[#f4bf4f]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{activity.cachetReward}</p>
              <p className="text-xs text-[#b8b2b3]">Cachet</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-lg flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="text-[#f4bf4f]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{activity.reputationReward}</p>
              <p className="text-xs text-[#b8b2b3]">Rep</p>
            </div>
          </div>
        </Card>

        <Card className="border border-[#f4bf4f]/30">
          <div className="flex gap-3">
            <AlertCircle className="text-[#f4bf4f] flex-shrink-0" size={20} />
            <div className="space-y-1">
              <p className="text-sm text-[#b8b2b3]">
                Minigioco disponibile: <span className="text-white">{minigame.title}</span>
              </p>
              <p className="text-xs text-[#7a7577]">{minigame.subtitle}</p>
            </div>
          </div>
        </Card>

        {lockMessage || notice ? (
          <Card className="border border-[#ff4d4f]/40 bg-[#2a1517]">
            <p className="text-sm text-[#ff9b9b]">{notice ?? lockMessage}</p>
          </Card>
        ) : null}

        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onStart}
            disabled={!availability.canPlay}
          >
            <Play size={20} />
            {!availability.canPlay ? 'Minigioco bloccato' : 'Avvia minigioco'}
          </Button>

          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            Torna indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
