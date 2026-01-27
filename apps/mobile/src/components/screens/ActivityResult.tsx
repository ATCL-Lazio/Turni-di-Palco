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

  return (
    <div className="min-h-screen pb-24">
      <div className="app-content px-6 pt-6 space-y-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#52c41a] to-[#389e0d] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-white" size={40} />
          </div>
          <h2 className="text-white mb-2">Attivita completata</h2>
          <p className="text-sm text-[#b8b2b3]">{activity.title}</p>
        </div>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-white">Prestazione</h4>
              <p className="text-sm text-[#b8b2b3]">Punteggio medio</p>
            </div>
            <Badge variant={ratingVariant} size="md">
              <Star size={14} />
              {outcome.rating}
            </Badge>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-4xl text-white">{outcome.score}</p>
            <p className="text-sm text-[#7a7577]">/100</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {outcome.roundScores.map((score, index) => (
              <Badge key={`${activity.id}-round-${index}`} variant="outline" size="sm">
                Round {index + 1}: {score}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <h4 className="text-[#f4bf4f] mb-4">Ricompense</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#0f0d0e]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.xp}</p>
              <p className="text-xs text-[#b8b2b3]">XP</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-lg flex items-center justify-center mx-auto mb-2">
                <Award className="text-[#f4bf4f]" size={24} />
              </div>
              <p className="text-2xl text-white mb-1">+{rewards.reputation}</p>
              <p className="text-xs text-[#b8b2b3]">Reputazione</p>
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

        <Button variant="primary" size="lg" fullWidth onClick={onDone}>
          Torna alle attivita
        </Button>
      </div>
    </div>
  );
}
