import React, { useMemo } from 'react';
import { CheckCircle2, Coins, Award, TrendingUp, Star } from 'lucide-react';
import { Activity, Rewards } from '../../state/store';
import { MinigameOutcome } from '../../gameplay/minigames';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ActivityResultProps {
  activity: Activity;
  rewards: Rewards;
  outcome: MinigameOutcome;
  onDone: () => void;
}

export function ActivityResult({ activity, rewards, outcome, onDone }: ActivityResultProps) {
  const durationLabel = useMemo(() => {
    if (!outcome.durationMs) return null;
    const seconds = Math.max(1, Math.round(outcome.durationMs / 1000));
    return `${seconds}s`;
  }, [outcome.durationMs]);

  const ratingVariant = useMemo(() => {
    switch (outcome.rating) {
      case 'Perfetto':
        return 'gold';
      case 'Ottimo':
        return 'success';
      case 'Buono':
        return 'outline';
      default:
        return 'default';
    }
  }, [outcome.rating]);

  const resultSummary = `Attività ${activity.title} completata. Valutazione ${outcome.rating}, punteggio ${outcome.score} su 100. Ricompense: ${rewards.xp} XP, ${rewards.reputation} reputazione, ${rewards.cachet} cachet.`;

  return (
    <div className="min-h-screen pb-24">
      <div className="app-content px-6 pt-6 space-y-6">
        <div
          className="text-center"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={resultSummary}
        >
          <div aria-hidden="true" className="w-20 h-20 bg-gradient-to-br from-[--color-success] to-[--color-success]/80 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-white" size={40} />
          </div>
          <h2 className="text-white mb-2">Attivita completata</h2>
          <p className="text-sm text-muted">{activity.title}</p>
        </div>

        <Card className="bg-gradient-to-br from-surface to-surface-elevated">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-white">Prestazione</h4>
              <p className="text-sm text-muted">Punteggio medio</p>
            </div>
            <Badge variant={ratingVariant} size="md">
              <Star size={14} />
              {outcome.rating}
            </Badge>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-4xl text-white">{outcome.score}</p>
            <p className="text-sm text-subtle">/100</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {outcome.roundScores.map((score, index) => (
              <Badge key={`${activity.id}-round-${index}`} variant="outline" size="sm">
                Round {index + 1}: {score}
              </Badge>
            ))}
            <Badge variant="outline" size="sm">
              Tentativi: {outcome.attempts}
            </Badge>
            {durationLabel ? (
              <Badge variant="outline" size="sm">
                Tempo: {durationLabel}
              </Badge>
            ) : null}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-surface to-surface-elevated">
          <h4 className="text-accent mb-4">Ricompense</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-hover to-accent rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-primary-bg" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.xp}</p>
              <p className="text-xs text-muted">XP</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-burgundy-600 to-burgundy-800 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Award className="text-accent" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.reputation}</p>
              <p className="text-xs text-muted">Reputazione</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-surface-elevated rounded-lg flex items-center justify-center mx-auto mb-2">
                <Coins className="text-accent" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.cachet}</p>
              <p className="text-xs text-muted">Cachet</p>
            </div>
          </div>
        </Card>

        <Button variant="primary" size="lg" fullWidth onClick={onDone} aria-label="Torna alla lista attività">
          Torna alle attivita
        </Button>
      </div>
    </div>
  );
}
