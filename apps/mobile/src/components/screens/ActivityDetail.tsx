import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Play, Clock, TrendingUp, Coins, X, AlertCircle } from 'lucide-react';
import { Activity } from '../../state/store';
import { getMinigameConfig } from '../../gameplay/minigames';

interface ActivityDetailProps {
  activity: Activity;
  onStart: () => void;
  onClose: () => void;
}

export function ActivityDetail({ activity, onStart, onClose }: ActivityDetailProps) {
  const minigame = getMinigameConfig(activity.id);
  return (
    <div className="fixed inset-0 app-gradient z-50 overflow-y-auto pb-24">
      <div className="sticky top-0 bg-[#1c1c1e] border-b border-[#3a3a3c] p-4 flex items-center justify-between z-10">
        <h3 className="text-white">Dettagli attivitÃ </h3>
        <button onClick={onClose} className="flex items-center justify-center size-[44px] hover:bg-[#2c2c2e] rounded-lg transition-colors">
          <X className="text-[#0a84ff]" size={24} />
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
            <span className="text-[#aeaeb2]">{activity.difficulty}</span>
          </div>
        </div>

        <Card>
          <h4 className="text-white mb-2">Descrizione</h4>
          <p className="text-[#aeaeb2]">{activity.description}</p>
        </Card>

        <Card className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e]">
          <h4 className="text-[#0a84ff] mb-4">Ricompense</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#0066d6] to-[#0a84ff] rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#000000]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{activity.xpReward}</p>
              <p className="text-xs text-[#aeaeb2]">XP</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-[#2c2c2e] rounded-lg flex items-center justify-center mx-auto mb-2">
                <Coins className="text-[#0a84ff]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{activity.cachetReward}</p>
              <p className="text-xs text-[#aeaeb2]">Cachet</p>
            </div>
          </div>
        </Card>

        <Card className="border border-[#0a84ff]/30">
          <div className="flex gap-3">
            <AlertCircle className="text-[#0a84ff] flex-shrink-0" size={20} />
            <div className="space-y-1">
              <p className="text-sm text-[#aeaeb2]">
                Minigioco disponibile: <span className="text-white">{minigame.title}</span>
              </p>
              <p className="text-xs text-[#8e8e93]">{minigame.subtitle}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button variant="primary" size="lg" fullWidth onClick={onStart}>
            <Play size={20} />
            Avvia minigioco
          </Button>

          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            Torna indietro
          </Button>
        </div>
      </div>
    </div>
  );
}

