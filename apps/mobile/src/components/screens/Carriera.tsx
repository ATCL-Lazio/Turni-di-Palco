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
  Clipboard
} from 'lucide-react';
import { Screen, ScreenHeader } from '../ui/Screen';

interface CarrieraProps {
  userName: string;
  userRole: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpTotal: number;
  xpSulCampo: number;
  reputationGlobal: number;
  onBack: () => void;
}

const roleIcons: Record<string, React.ElementType> = {
  'Attore / Attrice': Users,
  'Tecnico Luci': Lightbulb,
  'Fonico': Volume2,
  'Attrezzista / Scenografo': Package,
  'Assistente di Palco': Clipboard
};

const roleStats = {
  presence: 90,
  precision: 70,
  leadership: 60,
  creativity: 85
};

export function Carriera({
  userName,
  userRole,
  level,
  xp,
  xpToNextLevel,
  xpTotal,
  xpSulCampo,
  reputationGlobal,
  onBack
}: CarrieraProps) {
  const RoleIcon = roleIcons[userRole] || Users;

  return (
    <Screen
      header={(
        <ScreenHeader>
          <div className="max-w-md mx-auto">
            <button
              onClick={onBack}
              className="flex items-center gap-2 rounded-md px-2 py-[10px] text-[#f4bf4f] mb-6 hover:text-[#e6a23c] transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Indietro</span>
            </button>

            <h2 className="text-white mb-2">Carriera completa</h2>
            <p className="text-[#b8b2b3]">Il tuo percorso professionale a teatro</p>
          </div>
        </ScreenHeader>
      )}
    >
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
          {Object.entries(roleStats).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between mb-2">
                <span className="text-[#b8b2b3] capitalize">
                  {key === 'presence' ? 'Presenza scenica' :
                   key === 'precision' ? 'Precisione' :
                   key === 'leadership' ? 'Leadership' : 'Creatività'}
                </span>
                <span className="text-white">{value}/100</span>
              </div>
              <ProgressBar value={value} max={100} color="burgundy" size="sm" />
            </div>
          ))}
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
        <h4 className="text-white mb-4">Traguardi carriera</h4>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-[#52c41a]/10 border border-[#52c41a]/30 rounded-lg">
            <div className="w-8 h-8 bg-[#52c41a] rounded-lg flex items-center justify-center flex-shrink-0">
              <Theater className="text-white" size={16} />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm">12 turni ATCL completati</p>
              <p className="text-xs text-[#b8b2b3]">Completato</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#52c41a]/10 border border-[#52c41a]/30 rounded-lg">
            <div className="w-8 h-8 bg-[#52c41a] rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="text-white" size={16} />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm">3 teatri diversi</p>
              <p className="text-xs text-[#b8b2b3]">Completato</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#241f20] border border-[#2d2728] rounded-lg opacity-60">
            <div className="w-8 h-8 bg-[#7a7577] rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="text-white" size={16} />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm">Stagione completa</p>
              <p className="text-xs text-[#b8b2b3]">In corso: 12/20 eventi</p>
            </div>
          </div>
        </div>
      </Card>
    </Screen>
  );
}
