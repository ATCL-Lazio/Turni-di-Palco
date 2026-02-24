import React from 'react';
import { Clock, Coins, Play, TrendingUp, Flag } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { ProgressBar } from '../ui/ProgressBar';
import { Activity, ActivitySlotsStatus } from '../../state/store';

interface ActivitiesProps {
  activities: Activity[];
  slotsStatus: ActivitySlotsStatus;
  slotsLoading?: boolean;
  isOnline?: boolean;
  onStartActivity: (activityId: string) => void;
}

const difficultyLabels: Record<Activity['difficulty'], string> = {
  Facile: 'Principiante',
  Medio: 'Intermedio',
  Difficile: 'Avanzato',
};

export function Activities({
  activities,
  slotsStatus,
  slotsLoading = false,
  isOnline = true,
  onStartActivity,
}: ActivitiesProps) {
  const totalActivities = activities.length;
  const dailyGoal = slotsStatus.totalSlots;
  const completedToday = slotsStatus.usedToday;
  const remainingSlots = slotsStatus.remainingSlots;
  const dailyProgress = dailyGoal > 0 ? Math.min((completedToday / dailyGoal) * 100, 100) : 0;

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

        <Card className="border border-[#2d2728] bg-[#1a1617]">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">Missioni giornaliere</p>
              <h3 className="text-white text-lg font-semibold">
                {completedToday}/{dailyGoal} completate oggi
              </h3>
              {slotsLoading ? (
                <p className="text-sm text-[#b8b2b3]">Verifica slot in corso...</p>
              ) : null}
            </div>
            <div className="w-12 h-12 rounded-full bg-[#241f20] flex items-center justify-center">
              <Flag className="text-[#f4bf4f]" size={22} />
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={dailyProgress} max={100} color="gold" size="md" />
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
            {activities.map((activity, index) => {
              const difficultyLabel = difficultyLabels[activity.difficulty] ?? activity.difficulty;
              const canStart = isOnline && remainingSlots > 0;
              return (
                <Card
                  key={activity.id}
                  hoverable={canStart}
                  onClick={canStart ? () => onStartActivity(activity.id) : undefined}
                  className="border border-white/5 bg-gradient-to-br from-[#1a1617] via-[#1d1819] to-[#221d1e]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-2xl flex items-center justify-center">
                      <Play className="text-[#f4bf4f]" size={22} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-[#b8b2b3]">Missione {index + 1}</p>
                          <h4 className="text-white text-lg">{activity.title}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-[#f4bf4f]">
                          <Play size={18} />
                        </div>
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
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                          <TrendingUp size={12} className="text-[#f4bf4f]" />
                          +{activity.xpReward} XP
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
                          <Coins size={12} className="text-[#f4bf4f]" />
                          +{activity.cachetReward}
                        </span>
                      </div>
                      {!canStart ? (
                        <p className="text-xs text-[#ff9aac]">
                          {!isOnline
                            ? 'Per completare attività serve connessione online.'
                            : 'Limite slot giornalieri raggiunto.'}
                        </p>
                      ) : null}
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
