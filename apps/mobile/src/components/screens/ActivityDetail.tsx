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
      <div className="sticky top-0 bg-surface border-b border-border p-4 flex items-center justify-between z-10">
        <h3 className="text-white">Dettagli attività</h3>
        <button type="button" onClick={onClose} aria-label="Chiudi"
          className="flex items-center justify-center size-[44px] hover:bg-[#241f20] rounded-lg transition-colors">
          <X className="text-accent" size={24} aria-hidden="true" />
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
            <span className="text-fg-secondary">{activity.difficulty}</span>
          </div>
        </div>

        <Card>
          <p className="text-fg-secondary">{activity.description}</p>
        </Card>

        <Card className="bg-gradient-to-br from-surface to-surface-elevated">
          <h4 className="text-accent mb-4">Ricompense</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-gold-500 to-gold-400 rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#0f0d0e]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.xp}</p>
              <p className="text-xs text-fg-secondary">XP</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-surface-elevated rounded-lg flex items-center justify-center mx-auto mb-2">
                <Coins className="text-accent" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.cachet}</p>
              <p className="text-xs text-fg-secondary">Cachet</p>
            </div>
          </div>
        </Card>

        <Card className="border border-accent/30">
          <div className="flex gap-3">
            <AlertCircle className="text-accent flex-shrink-0" size={20} />
            <div className="space-y-1">
              <p className="text-sm text-white">{minigame.title}</p>
              <p className="text-xs text-fg-secondary">{minigame.subtitle}</p>
              {roleHighlight?.highlightLabel ? (
                <p className="text-xs text-accent">{roleHighlight.highlightLabel}</p>
              ) : null}
              {roleHighlight?.homeNote ? (
                <p className="text-xs text-fg-secondary">{roleHighlight.homeNote}</p>
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
