import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Play, Clock, TrendingUp, Coins, X, AlertCircle } from 'lucide-react';
import { Activity, Role, computeActivityRewards, getRoleActivityOverride } from '../../state/store';
import { getMinigameConfig } from '../../gameplay/minigames';

interface ActivityDetailProps {
  activity: Activity;
  role?: Role;
  onStart: () => void;
  onClose: () => void;
}

export function ActivityDetail({ activity, role, onStart, onClose }: ActivityDetailProps) {
  const minigame = getMinigameConfig(activity.id, role?.id, role?.stats ?? null);
  const rewards = computeActivityRewards(activity, role);
  const roleHighlight = getRoleActivityOverride(role, activity.id);
  return (
    <div className="fixed inset-0 app-gradient z-50 overflow-y-auto pb-24">
      <div className="sticky top-0 bg-[#1a1617] border-b border-[#2d2728] p-4 flex items-center justify-between z-10">
        <h3 className="text-white">Dettagli attività</h3>
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
          </div>
        </div>

        <Card>
          <p className="text-[#b8b2b3]">{activity.description}</p>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <h4 className="text-[#f4bf4f] mb-4">Ricompense</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#0f0d0e]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.xp}</p>
              <p className="text-xs text-[#b8b2b3]">XP</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-[#241f20] rounded-lg flex items-center justify-center mx-auto mb-2">
                <Coins className="text-[#f4bf4f]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.cachet}</p>
              <p className="text-xs text-[#b8b2b3]">Cachet</p>
            </div>
          </div>
        </Card>

        <Card className="border border-[#f4bf4f]/30">
          <div className="flex gap-3">
            <AlertCircle className="text-[#f4bf4f] flex-shrink-0" size={20} />
            <div className="space-y-1">
              <p className="text-sm text-white">{minigame.title}</p>
              <p className="text-xs text-[#b8b2b3]">{minigame.subtitle}</p>
              {roleHighlight?.highlightLabel ? (
                <p className="text-xs text-[#f4bf4f]">{roleHighlight.highlightLabel}</p>
              ) : null}
              {roleHighlight?.homeNote ? (
                <p className="text-xs text-[#9b9496]">{roleHighlight.homeNote}</p>
              ) : null}
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
