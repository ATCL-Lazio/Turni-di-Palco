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
  const minigame = getMinigameConfig(activity.id, role?.id);
  const rewards = computeActivityRewards(activity, role);
  const roleHighlight = getRoleActivityOverride(role, activity.id);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-detail-title"
      aria-describedby="activity-detail-description"
      className="fixed inset-0 app-gradient z-50 overflow-y-auto pb-24"
    >
      <div className="sticky top-0 bg-surface border-b border-surface-hover p-4 flex items-center justify-between z-10">
        <h3 className="text-white">Dettagli attività</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi dettagli attività"
          className="flex items-center justify-center size-[44px] hover:bg-surface-elevated rounded-lg transition-colors"
        >
          <X aria-hidden="true" className="text-accent" size={24} />
        </button>
      </div>

      <div className="app-content px-6 py-6 space-y-6">
        <section aria-labelledby="activity-detail-title">
          <h2 id="activity-detail-title" className="text-white mb-2">{activity.title}</h2>
          <div className="flex items-center gap-3">
            <Badge variant="outline" size="md">
              <Clock aria-hidden="true" size={14} />
              <span aria-label={`Durata ${activity.duration}`}>{activity.duration}</span>
            </Badge>
            <span className="text-muted" aria-label={`Difficoltà ${activity.difficulty}`}>{activity.difficulty}</span>
          </div>
        </section>

        <Card>
          <p id="activity-detail-description" className="text-muted">{activity.description}</p>
        </Card>

        <Card className="bg-gradient-to-br from-surface to-surface-elevated">
          <section aria-labelledby="activity-rewards-heading">
            <h4 id="activity-rewards-heading" className="text-accent mb-4">Ricompense</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center" aria-label={`Ricompensa esperienza: ${rewards.xp} XP`}>
                <div aria-hidden="true" className="w-12 h-12 bg-gradient-to-br from-accent-hover to-accent rounded-lg flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="text-primary-bg" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{rewards.xp}</p>
                <p className="text-xs text-muted">XP</p>
              </div>

              <div className="text-center" aria-label={`Ricompensa cachet: ${rewards.cachet}`}>
                <div aria-hidden="true" className="w-12 h-12 bg-surface-elevated rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Coins className="text-accent" size={24} />
                </div>
                <p className="text-2xl text-white mb-1">+{rewards.cachet}</p>
                <p className="text-xs text-muted">Cachet</p>
              </div>
            </div>
          </section>
        </Card>

        <Card className="border border-accent/30">
          <div className="flex gap-3">
            <AlertCircle aria-hidden="true" className="text-accent flex-shrink-0" size={20} />
            <div className="space-y-1">
              <p className="text-sm text-white">{minigame.title}</p>
              <p className="text-xs text-muted">{minigame.subtitle}</p>
              {roleHighlight?.highlightLabel ? (
                <p className="text-xs text-accent">{roleHighlight.highlightLabel}</p>
              ) : null}
              {roleHighlight?.homeNote ? (
                <p className="text-xs text-subtle">{roleHighlight.homeNote}</p>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button variant="primary" size="lg" fullWidth onClick={onStart} aria-label={`Avvia minigioco: ${minigame.title}`}>
            <Play aria-hidden="true" size={20} />
            Avvia minigioco
          </Button>

          <Button variant="ghost" size="lg" fullWidth onClick={onClose} aria-label="Torna alla lista attività">
            Torna indietro
          </Button>
        </div>
      </div>
    </div>
  );
}
