import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import {
  ArrowLeft,
  TrendingUp,
  Award,
  Theater,
  MapPin,
  Calendar,
  Users,
  Lightbulb,
  Volume2,
  Package,
  Clipboard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Screen } from '../ui/Screen';
import type { Badge as GameBadge, Role, RoleId, TurnRecord, TurnStats } from '../../state/store';

interface CareerProps {
  userRole: string;
  roleId: RoleId;
  roleStats: Role['stats'];
  turnStats: TurnStats;
  badges: GameBadge[];
  turns: TurnRecord[];
  roles: Role[];
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpTotal: number;
  xpSulCampo: number;
  reputationGlobal: number;
  onBack: () => void;
}

const ROLE_ICONS: Record<RoleId, React.ElementType> = {
  attore: Users,
  luci: Lightbulb,
  fonico: Volume2,
  attrezzista: Package,
  palco: Clipboard,
};

const ROLE_STAT_KEYS = ['presence', 'precision', 'leadership', 'creativity'] as const;

const ROLE_STAT_LABELS: Record<keyof Role['stats'], string> = {
  presence: 'Presenza scenica',
  precision: 'Precisione',
  leadership: 'Leadership',
  creativity: 'CreativitÃ ',
};

const BADGE_ICONS: Record<string, LucideIcon> = { Award, MapPin, Theater, Calendar };

function getBadgeProgressText(badge: GameBadge, turnStats: TurnStats) {
  if (badge.unlocked) return 'Completato';
  if (!badge.metric || badge.metric === 'manual' || badge.threshold == null) return 'Da sbloccare';

  const current =
    badge.metric === 'total_turns'
      ? turnStats.totalTurns
      : badge.metric === 'turns_this_month'
        ? turnStats.turnsThisMonth
        : badge.metric === 'unique_theatres'
          ? turnStats.uniqueTheatres
          : null;

  if (current == null) return 'Da sbloccare';

  const unit = badge.metric === 'unique_theatres' ? 'teatri' : 'turni';
  return `In corso: ${current}/${badge.threshold} ${unit}`;
}

export function Career({
  userRole,
  roleId,
  roleStats,
  turnStats,
  badges,
  turns,
  roles,
  level,
  xp,
  xpToNextLevel,
  xpTotal,
  xpSulCampo,
  reputationGlobal,
  onBack,
}: CareerProps) {
  const RoleIcon = ROLE_ICONS[roleId] ?? Users;
  const sortedTurns = React.useMemo(() => [...turns].sort((a, b) => b.createdAt - a.createdAt), [turns]);
  const resolveRoleName = (roleIdValue: RoleId) =>
    roles.find((role) => role.id === roleIdValue)?.name ?? 'Ruolo';
  const milestones = React.useMemo(() => {
    return [...badges].sort(
      (a, b) =>
        Number(b.unlocked) - Number(a.unlocked) ||
        (a.threshold ?? Number.POSITIVE_INFINITY) - (b.threshold ?? Number.POSITIVE_INFINITY) ||
        a.title.localeCompare(b.title)
    );
  }, [badges]);

  return (
    <Screen
      className="relative items-start justify-start"
      contentClassName="relative w-full flex-1 px-6 pt-8 space-y-0 box-border"
    >
      <div className="flex flex-col">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center size-[44px] text-[#0a84ff]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4">
          <h2 className="text-white mb-2">Carriera completa</h2>
          <p className="text-[#aeaeb2]">Il tuo percorso professionale a teatro</p>
        </div>

        <div className="mt-6 space-y-5">
          <Card className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e]">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-[#0a84ff] to-[#004ea8] rounded-2xl flex items-center justify-center">
                <RoleIcon className="text-[#0a84ff]" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-white mb-1">{userRole}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="gold" size="md">Livello {level}</Badge>
                  <span className="text-[#aeaeb2]">{xp} XP</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-[#aeaeb2] mb-2">
                <span>Progressione livello</span>
                <span>{xpToNextLevel - xp} XP al prossimo</span>
              </div>
              <ProgressBar value={xp} max={xpToNextLevel} color="gold" />
            </div>
          </Card>

          <Card>
            <h4 className="text-white mb-4">Caratteristiche ruolo</h4>

            <div className="space-y-4">
              {ROLE_STAT_KEYS.map((key) => {
                const value = roleStats[key] ?? 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between mb-2">
                      <span className="text-[#aeaeb2]">{ROLE_STAT_LABELS[key]}</span>
                      <span className="text-white">{value}/100</span>
                    </div>
                    <ProgressBar value={value} max={100} color="burgundy" size="sm" />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h4 className="text-white mb-4">Esperienza accumulata</h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#2c2c2e] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0066d6] to-[#0a84ff] rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-[#000000]" size={20} />
                  </div>
                  <div>
                    <p className="text-white">XP totale</p>
                    <p className="text-xs text-[#aeaeb2]">Tutte le fonti</p>
                  </div>
                </div>
                <p className="text-2xl text-white">{xpTotal}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#2c2c2e] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0a84ff] to-[#004ea8] rounded-lg flex items-center justify-center">
                    <Theater className="text-[#0a84ff]" size={20} />
                  </div>
                  <div>
                    <p className="text-white">XP sul campo</p>
                    <p className="text-xs text-[#aeaeb2]">Eventi ATCL reali</p>
                  </div>
                </div>
                <p className="text-2xl text-[#0a84ff]">{xpSulCampo}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#2c2c2e] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#2c2c2e] border-2 border-[#8e8e93] rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-[#8e8e93]" size={20} />
                  </div>
                  <div>
                    <p className="text-white">XP da attivitÃ </p>
                    <p className="text-xs text-[#aeaeb2]">Simulazioni</p>
                  </div>
                </div>
                <p className="text-2xl text-white">{xpTotal - xpSulCampo}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h4 className="text-white mb-4">Reputazione</h4>

            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-[#2c2c2e] to-[#1c1c1e] rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#0a84ff] to-[#004ea8] rounded-xl flex items-center justify-center">
                  <Award className="text-[#0a84ff]" size={24} />
                </div>
                <div>
                  <p className="text-white">Reputazione ATCL</p>
                  <p className="text-xs text-[#aeaeb2]">Globale</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl text-white">{reputationGlobal}</p>
                <p className="text-xs text-[#aeaeb2]">/ 100</p>
              </div>
            </div>

            <ProgressBar value={reputationGlobal} max={100} color="burgundy" />
          </Card>

          <Card>
            <h4 className="text-white mb-4">Traguardi carriera</h4>

            <div className="space-y-3">
              {milestones.length ? (
                milestones.map((milestone) => {
                  const Icon = BADGE_ICONS[milestone.icon] ?? Award;
                  const unlocked = milestone.unlocked;
                  return (
                    <div
                      key={milestone.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${unlocked
                          ? 'bg-[#30d158]/10 border border-[#30d158]/30'
                          : 'bg-[#2c2c2e] border border-[#3a3a3c] opacity-60'
                        }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${unlocked ? 'bg-[#30d158]' : 'bg-[#8e8e93]'
                          }`}
                      >
                        <Icon className="text-white" size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{milestone.title}</p>
                        <p className="text-xs text-[#aeaeb2]">
                          {getBadgeProgressText(milestone, turnStats)}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[#aeaeb2]">Nessun traguardo disponibile</p>
              )}
            </div>
          </Card>

          <Card>
            <h4 className="text-white mb-4">Storia turni</h4>
            {sortedTurns.length ? (
              <div className="space-y-3">
                {sortedTurns.map((turno) => (
                  <div key={turno.id} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-[#2c2c2e] rounded-lg flex items-center justify-center">
                      <Theater className="text-[#0a84ff]" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white mb-1">{turno.eventName}</h4>
                      <div className="flex items-center gap-2 text-sm text-[#aeaeb2] mb-2">
                        <MapPin size={14} />
                        <span>{turno.theatre}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#aeaeb2] mb-3">
                        <Calendar size={14} />
                        <span>{turno.date} Â· {turno.time}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" size="sm">
                          {resolveRoleName(turno.roleId)}
                        </Badge>
                        <Badge variant="gold" size="sm">
                          +{turno.rewards.xp} XP
                        </Badge>
                        <Badge variant="success" size="sm">
                          +{turno.rewards.reputation} Rep
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#aeaeb2]">Nessun turno registrato</p>
            )}
          </Card>
        </div>
      </div>
    </Screen>
  );
}

