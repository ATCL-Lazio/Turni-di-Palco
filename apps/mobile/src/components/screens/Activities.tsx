import React from 'react';
import { Clock, Coins, Flag, Play, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag } from '../ui/Tag';
import { ProgressBar } from '../ui/ProgressBar';
import { Screen } from '../ui/Screen';
import { Activity, ActivitySlotsStatus, Role, computeActivityRewards, getRoleActivityOverride } from '../../state/store';

interface ActivitiesProps {
  activities: Activity[];
  activeRole?: Role;
  slotsStatus: ActivitySlotsStatus;
  slotsLoading?: boolean;
  isOnline?: boolean;
  canStartActivities?: boolean;
  embedded?: boolean;
  recommendedActivityId?: string;
  onStartActivity: (activityId: string) => void;
}

const difficultyLabels: Record<Activity['difficulty'], string> = {
  Facile: 'Principiante',
  Medio: 'Intermedio',
  Difficile: 'Avanzato',
};

export function Activities({
  activities, activeRole, slotsStatus, slotsLoading = false,
  isOnline = true, canStartActivities = true, embedded = false,
  recommendedActivityId, onStartActivity,
}: ActivitiesProps) {
  const totalActivities = activities.length;
  const dailyGoal = slotsStatus.totalSlots;
  const completedToday = slotsStatus.usedToday;
  const remainingSlots = slotsStatus.remainingSlots;
  const dailyProgress = dailyGoal > 0 ? Math.min((completedToday / dailyGoal) * 100, 100) : 0;

  const content = (
    <>
      <header className="space-y-2">
        <h2 className="text-white">Attività simulate</h2>
        <p className="text-muted">Migliora le tue skill e guadagna ricompense</p>
      </header>

      <TrainingBanner />

      <DailyProgressCard
        completedToday={completedToday}
        dailyGoal={dailyGoal}
        dailyProgress={dailyProgress}
        slotsLoading={slotsLoading}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white">Attività disponibili</h3>
          <Tag size="sm" variant="info">{totalActivities} disponibili</Tag>
        </div>

        <div className="space-y-3">
          {activities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              index={index}
              activeRole={activeRole}
              canStart={canStartActivities && isOnline && remainingSlots > 0}
              canStartActivities={canStartActivities}
              isOnline={isOnline}
              isRecommended={recommendedActivityId === activity.id}
              onStart={() => onStartActivity(activity.id)}
            />
          ))}
        </div>
      </section>

      {totalActivities === 0 && (
        <Card className="text-center">
          <p className="text-sm text-subtle">Nuove attività in arrivo</p>
          <p className="text-sm text-muted">Stiamo preparando nuove sfide e attività</p>
        </Card>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return <Screen contentClassName="px-6 pt-6 pb-8 space-y-6">{content}</Screen>;
}

// === Sub-components ===

function TrainingBanner() {
  return (
    <Card className="border border-accent/30 bg-gradient-to-br from-surface to-surface-elevated">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-burgundy-600 to-burgundy-800 rounded-xl flex items-center justify-center">
          <TrendingUp className="text-accent" size={22} />
        </div>
        <div className="space-y-1">
          <h3 className="text-white">Allenati ogni giorno</h3>
          <p className="text-sm text-muted">
            Completa le attività per migliorare le tue competenze e prepararti per gli eventi reali
          </p>
        </div>
      </div>
    </Card>
  );
}

function DailyProgressCard({
  completedToday, dailyGoal, dailyProgress, slotsLoading,
}: {
  completedToday: number;
  dailyGoal: number;
  dailyProgress: number;
  slotsLoading: boolean;
}) {
  return (
    <Card className="border border-surface-hover bg-surface">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">Missioni giornaliere</p>
          <h3 className="text-white text-lg font-semibold">{completedToday}/{dailyGoal} completate oggi</h3>
          {slotsLoading && <p className="text-sm text-muted">Verifica slot in corso...</p>}
        </div>
        <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center">
          <Flag className="text-accent" size={22} />
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar value={dailyProgress} max={100} color="gold" size="md" />
      </div>
    </Card>
  );
}

function ActivityCard({
  activity, index, activeRole, canStart, canStartActivities, isOnline, isRecommended, onStart,
}: {
  activity: Activity;
  index: number;
  activeRole?: Role;
  canStart: boolean;
  canStartActivities: boolean;
  isOnline: boolean;
  isRecommended: boolean;
  onStart: () => void;
}) {
  const difficultyLabel = difficultyLabels[activity.difficulty] ?? activity.difficulty;
  const rewardPreview = computeActivityRewards(activity, activeRole);
  const roleHighlight = getRoleActivityOverride(activeRole, activity.id)?.highlightLabel;

  const cardLabel = canStart
    ? `Avvia attività: ${activity.title}. Difficoltà ${difficultyLabel}. Ricompensa ${rewardPreview.xp} XP e ${rewardPreview.cachet} cachet`
    : `${activity.title} (non disponibile)`;

  return (
    <Card
      hoverable={canStart}
      onClick={canStart ? onStart : undefined}
      aria-label={cardLabel}
      aria-disabled={!canStart}
      className="border border-white/5 bg-gradient-to-br from-surface via-surface to-surface-elevated"
    >
      <div className="flex items-start gap-4">
        <div aria-hidden="true" className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-burgundy-600 to-burgundy-800 rounded-2xl flex items-center justify-center">
          <Play className="text-accent" size={22} />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Missione {index + 1}</p>
              <h4 className="text-white text-lg">{activity.title}</h4>
            </div>
            <div aria-hidden="true" className="flex items-center gap-2 text-accent"><Play size={18} /></div>
          </div>

          <p className="text-sm text-muted">{activity.description}</p>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2"><Clock size={14} />{activity.duration}</span>
            <Badge variant="outline" size="sm">{difficultyLabel}</Badge>
            {isRecommended && (
              <Tag size="sm" variant="success">Consigliata per {activeRole?.name ?? 'il tuo ruolo'}</Tag>
            )}
            {roleHighlight && <Tag size="sm" variant="outline">{roleHighlight}</Tag>}
          </div>

          <RewardTags xp={rewardPreview.xp} cachet={rewardPreview.cachet} />

          {!canStart && (
            <p className="text-xs text-[--color-error]">
              {!canStartActivities ? 'Funzione temporaneamente disattivata.'
                : !isOnline ? 'Per completare attività serve connessione online.'
                : 'Limite slot giornalieri raggiunto.'}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function RewardTags({ xp, cachet }: { xp: number; cachet: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
        <TrendingUp size={12} className="text-accent" /> +{xp} XP
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 backdrop-blur">
        <Coins size={12} className="text-accent" /> +{cachet}
      </span>
    </div>
  );
}
