import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Play, Clock, TrendingUp, Coins, Theater } from 'lucide-react';
import { Activity } from '../../state/store';
import { Screen, ScreenHeader } from '../ui/Screen';

interface AttivitaProps {
  activities: Activity[];
  onStartActivity: (activityId: string) => void;
}

export function Attivita({ activities, onStartActivity }: AttivitaProps) {
  const getDifficultyColor = (difficulty: Activity['difficulty']) => {
    switch (difficulty) {
      case 'Facile':
        return 'text-[#52c41a]';
      case 'Medio':
        return 'text-[#faad14]';
      case 'Difficile':
        return 'text-[#ff4d4f]';
      default:
        return 'text-[#b8b2b3]';
    }
  };

  return (
    <Screen
      header={(
        <ScreenHeader>
          <div className="w-full max-w-md mx-auto">
            <h2 className="text-white mb-2">Attività simulate</h2>
            <p className="text-[#b8b2b3]">Migliora le tue skill e guadagna ricompense</p>
          </div>
        </ScreenHeader>
      )}
    >
      <Card className="border border-[#f4bf4f]/30">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center">
            <Theater className="text-[#0f0d0e]" size={20} />
          </div>
          <div>
            <h4 className="text-white mb-1">Allenati ogni giorno</h4>
            <p className="text-sm text-[#b8b2b3]">
              Completa le attività per migliorare le tue competenze e prepararti per gli eventi reali
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <h3 className="text-white">Attività disponibili</h3>

        {activities.map((activity) => (
          <Card key={activity.id} hoverable onClick={() => onStartActivity(activity.id)}>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center">
                <Play className="text-[#f4bf4f]" size={24} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-white">{activity.title}</h4>
                  <Play className="text-[#f4bf4f] flex-shrink-0" size={20} />
                </div>

                <p className="text-sm text-[#b8b2b3] mb-3">{activity.description}</p>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1 text-sm text-[#b8b2b3]">
                    <Clock size={14} />
                    <span>{activity.duration}</span>
                  </div>

                  <span className={`text-sm ${getDifficultyColor(activity.difficulty)}`}>{activity.difficulty}</span>
                </div>

                <div className="flex gap-2">
                  <Badge variant="gold" size="sm">
                    <TrendingUp size={12} />
                    +{activity.xpReward} XP
                  </Badge>
                  <Badge variant="default" size="sm">
                    <Coins size={12} />
                    +{activity.cachetReward}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-[#1a1617] border border-[#2d2728]">
        <div className="text-center py-4">
          <p className="text-[#7a7577] mb-1">Nuove attività in arrivo</p>
          <p className="text-sm text-[#b8b2b3]">Stiamo preparando nuove sfide e minigames</p>
        </div>
      </Card>
    </Screen>
  );
}
