import React from 'react';
import { Clock, Coins, Play, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { Activity } from '../../state/store';

interface ActivitiesProps {
  activities: Activity[];
  onStartActivity: (activityId: string) => void;
}

const difficultyLabels: Record<Activity['difficulty'], string> = {
  Facile: 'Principiante',
  Medio: 'Intermedio',
  Difficile: 'Avanzato',
};

export function Activities({ activities, onStartActivity }: ActivitiesProps) {
  const totalActivities = activities.length;

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <div className="w-full app-content px-6 pt-6 pb-8 space-y-6">
        <header className="space-y-2">
          <h2 className="text-white">Attività simulate</h2>
          <p className="text-[#b8b2b3]">
            Migliora le tue skill e guadagna ricompense
          </p>
        </header>

        <Card className="border border-[#f4bf4f]/30 bg-gradient-to-br from-[#1a1617] to-[#241f20]">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center">
              <TrendingUp className="text-[#f4bf4f]" size={22} />
            </div>
            <div className="space-y-1">
              <h3 className="text-white">Allenati ogni giorno</h3>
              <p className="text-sm text-[#b8b2b3]">
                Completa le attività per migliorare le tue competenze e prepararti per gli eventi reali
              </p>
            </div>
          </div>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white">Attività disponibili</h3>
            <Tag size="sm" variant="info">
              {totalActivities} disponibili
            </Tag>
          </div>

          <div className="space-y-3">
            {activities.map((activity) => {
              const difficultyLabel = difficultyLabels[activity.difficulty] ?? activity.difficulty;
              return (
                <Card
                  key={activity.id}
                  hoverable
                  onClick={() => onStartActivity(activity.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center">
                      <Play className="text-[#f4bf4f]" size={22} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-white">{activity.title}</h4>
                        <Play className="text-[#f4bf4f]" size={18} />
                      </div>
                      <p className="text-sm text-[#b8b2b3]">
                        {activity.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[#b8b2b3]">
                        <span className="inline-flex items-center gap-2">
                          <Clock size={14} />
                          {activity.duration}
                        </span>
                        <Badge variant="outline" size="sm">
                          {difficultyLabel}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
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
              );
            })}
          </div>
        </section>

        {totalActivities === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-[#7a7577]">Nuove attività in arrivo</p>
            <p className="text-sm text-[#b8b2b3]">
              Stiamo preparando nuove sfide e attività
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
