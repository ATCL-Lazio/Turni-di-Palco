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
  BookOpen,
  ShieldCheck,
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
  dramaturg: BookOpen,
  rspp: ShieldCheck,
};

const ROLE_STAT_KEYS = ['presence', 'precision', 'leadership', 'creativity'] as const;

const ROLE_STAT_LABELS: Record<keyof Role['stats'], string> = {
  presence: 'Presenza scenica',
  precision: 'Precisione',
  leadership: 'Leadership',
  creativity: 'Creatività',
};

const BADGE_ICONS: Record<string, LucideIcon> = { Award, MapPin, Theater, Calendar, BookOpen };

function getBadgeGlyph(badge: GameBadge) {
  if (badge.icon === 'Developer' || badge.icon === 'developer_prompt') return '>_';
  return null;
}

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

  const unit =
    badge.metric === 'unique_theatres'
      ? 'teatri'
      : badge.metric === 'turns_this_month'
        ? 'turni questo mese'
        : 'turni';
  return `Obiettivo: ${current}/${badge.threshold} ${unit}`;
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
    return [...badges]
      .filter((badge) => badge.unlocked || !badge.isHidden)
      .sort(
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
          className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
          aria-label="Indietro"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="mt-4">
          <h2 className="text-white mb-2">Carriera completa</h2>
          <p className="text-[#b8b2b3]">Il tuo percorso professionale a teatro</p>
        </div>

        <div className="mt-6 space-y-5">
          <Card className="bg-gradient-to-br from-[#1a1617] to-[#241f20]">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-2xl flex items-center justify-center">
                <RoleIcon className="text-[#f4bf4f]" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-white mb-1">{userRole}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="gold" size="md">Livello {level}</Badge>
                  <span className="text-[#b8b2b3]">{xp} XP</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-[#b8b2b3] mb-2">
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
                      <span className="text-[#b8b2b3]">{ROLE_STAT_LABELS[key]}</span>
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
              <div className="flex items-center justify-between p-4 bg-[#241f20] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-[#0f0d0e]" size={20} />
                  </div>
                  <div>
                    <p className="text-white">XP totale</p>
                    <p className="text-xs text-[#b8b2b3]">Tutte le fonti</p>
                  </div>
                </div>
                <p className="text-2xl text-white">{xpTotal}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#241f20] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-lg flex items-center justify-center">
                    <Theater className="text-[#f4bf4f]" size={20} />
                  </div>
                  <div>
                    <p className="text-white">XP sul campo</p>
                    <p className="text-xs text-[#b8b2b3]">Eventi ATCL reali</p>
                  </div>
                </div>
                <p className="text-2xl text-[#f4bf4f]">{xpSulCampo}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#241f20] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#241f20] border-2 border-[#7a7577] rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-[#7a7577]" size={20} />
                  </div>
                  <div>
                    <p className="text-white">XP da attività</p>
                    <p className="text-xs text-[#b8b2b3]">Simulazioni</p>
                  </div>
                </div>
                <p className="text-2xl text-white">{xpTotal - xpSulCampo}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h4 className="text-white mb-4">Reputazione</h4>

            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-[#241f20] to-[#1a1617] rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center">
                  <Award className="text-[#f4bf4f]" size={24} />
                </div>
                <div>
                  <p className="text-white">Reputazione ATCL</p>
                  <p className="text-xs text-[#b8b2b3]">Globale</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl text-white">{reputationGlobal}</p>
                <p className="text-xs text-[#b8b2b3]">/ 100</p>
              </div>
            </div>

            <ProgressBar value={reputationGlobal} max={100} color="burgundy" />
          </Card>

          <Card>
            <h4 className="text-white mb-4">Traguardi e obiettivi</h4>

            <div className="space-y-3">
              {milestones.length ? (
                milestones.map((milestone) => {
                  const glyph = getBadgeGlyph(milestone);
                  const Icon = glyph ? null : BADGE_ICONS[milestone.icon] ?? Award;
                  const unlocked = milestone.unlocked;
                  return (
                    <div
                      key={milestone.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${unlocked
                          ? 'bg-[#52c41a]/10 border border-[#52c41a]/30'
                          : 'bg-[#241f20] border border-[#2d2728] opacity-60'
                        } ${milestone.isHidden ? 'secret-badge-frame' : ''}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${unlocked ? 'bg-[#52c41a]' : 'bg-[#7a7577]'
                          } ${milestone.isHidden ? 'secret-badge-shimmer' : ''}`}
                      >
                        {glyph ? (
                          <span className="font-mono text-[10px] leading-none font-bold tracking-[-0.08em] text-white relative z-[1]">
                            {glyph}
                          </span>
                        ) : Icon ? (
                          <Icon className="text-white relative z-[1]" size={16} />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{milestone.title}</p>
                        {milestone.isHidden ? (
                          <p className="secret-badge-label text-[10px] font-medium uppercase tracking-[0.14em] text-[#f4bf4f]">
                            Traguardo segreto
                          </p>
                        ) : null}
                        {milestone.description ? (
                          <p className="text-xs text-[#9b9496]">{milestone.description}</p>
                        ) : null}
                        <p className="text-xs text-[#b8b2b3]">
                          {getBadgeProgressText(milestone, turnStats)}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-[#b8b2b3]">Nessun traguardo disponibile</p>
              )}
            </div>
          </Card>

          <Card>
            <h4 className="text-white mb-4">Storia turni</h4>
            {sortedTurns.length ? (
              <div className="space-y-3">
                {sortedTurns.map((turno) => (
                  <div key={turno.id} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-[#241f20] rounded-lg flex items-center justify-center">
                      <Theater className="text-[#f4bf4f]" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white mb-1">{turno.eventName}</h4>
                      <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mb-2">
                        <MapPin size={14} />
                        <span>{turno.theatre}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mb-3">
                        <Calendar size={14} />
                        <span>{turno.date} · {turno.time}</span>
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
              <p className="text-sm text-[#b8b2b3]">Nessun turno registrato</p>
            )}
          </Card>
        </div>
      </div>
    </Screen>
  );
}
