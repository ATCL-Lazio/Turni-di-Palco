import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import {
  User,
  ChevronRight,
  Award,
  BarChart3,
  Settings,
  LogOut,
  MapPin,
  TrendingUp,
  Theater
} from 'lucide-react';
import { Screen, ScreenHeader } from '../ui/Screen';

interface ProfiloProps {
  userName: string;
  userRole: string;
  level: number;
  xp: number;
  xpTotal: number;
  xpSulCampo: number;
  reputationGlobal: number;
  onViewCarriera: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

const theatreReputation = [
  { name: 'Teatro Argentina', reputation: 85 },
  { name: 'Teatro Valle', reputation: 72 },
  { name: 'Teatro Quirino', reputation: 68 }
];

const achievements = [
  { id: '1', title: 'Ha lavorato in 3 teatri diversi', icon: MapPin },
  { id: '2', title: 'Prima stagione completata', icon: Award },
  { id: '3', title: '10 turni registrati', icon: Theater }
];

export function Profilo({
  userName,
  userRole,
  level,
  xp,
  xpTotal,
  xpSulCampo,
  reputationGlobal,
  onViewCarriera,
  onSettings,
  onLogout
}: ProfiloProps) {
  return (
    <Screen
      header={(
        <ScreenHeader>
          <div className="w-full max-w-md mx-auto text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <User className="text-[#f4bf4f]" size={48} />
            </div>

            <h2 className="text-white mb-1">{userName}</h2>
            <p className="text-[#f4bf4f] mb-4">{userRole}</p>

            <div className="flex items-center justify-center gap-4">
              <Badge variant="gold" size="md">
                Livello {level}
              </Badge>
              <Badge variant="outline" size="md">
                {reputationGlobal} Rep
              </Badge>
            </div>
          </div>
        </ScreenHeader>
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <Card hoverable onClick={onViewCarriera}>
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="text-[#f4bf4f]" size={24} />
            </div>
            <p className="text-white">Carriera</p>
          </div>
        </Card>

        <Card hoverable onClick={onSettings}>
          <div className="text-center">
            <div className="w-12 h-12 bg-[#241f20] rounded-xl flex items-center justify-center mx-auto mb-3">
              <Settings className="text-[#f4bf4f]" size={24} />
            </div>
            <p className="text-white">Impostazioni</p>
          </div>
        </Card>
      </div>

      <Card>
        <h4 className="text-white mb-4">Statistiche generali</h4>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-[#b8b2b3] mb-2">
              <span>XP totale</span>
              <span className="text-white">{xpTotal}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-[#b8b2b3] mb-2">
              <div className="flex items-center gap-2">
                <Theater size={14} />
                <span>XP sul campo (eventi ATCL)</span>
              </div>
              <span className="text-[#f4bf4f]">{xpSulCampo}</span>
            </div>
            <ProgressBar value={xpSulCampo} max={xpTotal} color="gold" />
          </div>

          <div>
            <div className="flex justify-between text-sm text-[#b8b2b3] mb-2">
              <span>Reputazione ATCL globale</span>
              <span className="text-white">{reputationGlobal}/100</span>
            </div>
            <ProgressBar value={reputationGlobal} max={100} color="burgundy" />
          </div>
        </div>
      </Card>

      <Card>
        <h4 className="text-white mb-4">Reputazione per teatro</h4>

        <div className="space-y-4">
          {theatreReputation.map((theatre) => (
            <div key={theatre.name}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#b8b2b3]">{theatre.name}</span>
                <span className="text-white">{theatre.reputation}/100</span>
              </div>
              <ProgressBar value={theatre.reputation} max={100} color="burgundy" size="sm" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white">Titoli ottenuti</h4>
          <Badge variant="gold" size="sm">{achievements.length}</Badge>
        </div>

        <div className="space-y-3">
          {achievements.map((achievement) => {
            const Icon = achievement.icon;
            return (
              <div
                key={achievement.id}
                className="flex items-center gap-3 p-3 bg-[#241f20] rounded-lg"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center">
                  <Icon className="text-[#0f0d0e]" size={20} />
                </div>
                <span className="text-[#b8b2b3]">{achievement.title}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card hoverable onClick={onSettings}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="text-[#f4bf4f]" size={24} />
            <div>
              <h4 className="text-white">Gestisci account</h4>
              <p className="text-sm text-[#b8b2b3]">Impostazioni e privacy</p>
            </div>
          </div>
          <ChevronRight className="text-[#7a7577]" size={20} />
        </div>
      </Card>

      <Button
        variant="ghost"
        size="lg"
        fullWidth
        onClick={onLogout}
        className="text-[#ff4d4f] hover:bg-[#ff4d4f]/10 mt-4"
      >
        <LogOut size={20} />
        Esci
      </Button>
    </Screen>
  );
}
