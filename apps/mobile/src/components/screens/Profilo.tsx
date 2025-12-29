import React from 'react';
import { Award, BarChart3, ChevronRight, LogOut, Settings, Theater, User } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar';
import { achievements } from '../../data/achievements_data';

interface ProfiloProps {
  userName: string;
  userRole: string;
  level: number;
  xp: number;
  xpTotal: number;
  xpSulCampo: number;
  reputationGlobal: number;
  onViewCarriera: () => void;
  onViewTitoli: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

const theatreReputation = [
  { name: 'Teatro Argentina', reputation: 85 },
  { name: 'Teatro Valle', reputation: 72 },
  { name: 'Teatro Quirino', reputation: 68 }
];

export function Profilo({
  userName,
  userRole,
  level,
  xpTotal,
  xpSulCampo,
  reputationGlobal,
  onViewCarriera,
  onViewTitoli,
  onSettings,
  onLogout
}: ProfiloProps) {
  const safeXpTotal = Math.max(xpTotal, 1);
  const roleLabel = (userRole ?? 'Ruolo').replace(/\s*\/\s*/g, '/');
  const newAchievementsCount = achievements.filter((achievement) => achievement.isNew).length;

  return (
    <div
      className="min-h-screen app-gradient"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
    >
      <div className="w-full max-w-[393px] mx-auto pt-[36px] pb-0 flex flex-col gap-[20px]">
        <div className="flex items-center px-[25px]">
          <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-full shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[96px] flex items-center justify-center">
            <User className="text-[#f4bf4f]" size={48} />
          </div>
          <div className="flex flex-col items-center w-[255px]">
            <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-white text-center">
              {userName || 'Utente'}
            </p>
            <p className="text-[16px] leading-[25.6px] text-[#f4bf4f] text-center">
              {roleLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[12px] px-[25px]">
          <button
            type="button"
            onClick={onViewCarriera}
            className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] flex items-center gap-[10px] px-[10px] py-[8px]"
          >
            <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-[16.4px] size-[48px] flex items-center justify-center">
              <BarChart3 className="text-[#f4bf4f]" size={24} />
            </div>
            <span className="flex-1 text-center text-[16px] leading-[25.6px] text-white">Carriera</span>
          </button>
          <button
            type="button"
            onClick={onSettings}
            className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] flex items-center gap-[10px] px-[10px] py-[8px]"
          >
            <div className="bg-[#241f20] rounded-[16.4px] size-[48px] flex items-center justify-center">
              <Settings className="text-[#f4bf4f]" size={24} />
            </div>
            <span className="flex-1 text-center text-[16px] leading-[25.6px] text-white">Impostazioni</span>
          </button>
        </div>

        <div className="flex flex-col gap-[20px] px-[25px]">
          <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[5px] py-[2px] flex flex-col gap-[8px]">
            <p className="text-[18px] leading-[25.2px] font-semibold text-white">
              Statistiche generali
            </p>
            <div className="flex items-center justify-between px-[5px] text-[14px] leading-[20px] text-[#b8b2b3]">
              <span>Livello</span>
              <span className="text-white">{level}</span>
            </div>
            <div className="flex items-center justify-between px-[5px] text-[14px] leading-[20px] text-[#b8b2b3]">
              <span>XP totale</span>
              <span className="text-white">{xpTotal}</span>
            </div>
            <div className="flex flex-col gap-[4px] px-[5px]">
              <div className="flex items-center justify-between text-[14px] leading-[20px] text-[#b8b2b3]">
                <span className="flex items-center gap-[8px]">
                  <Theater size={14} />
                  XP sul campo (eventi ATCL)
                </span>
                <span className="text-[#f4bf4f]">{xpSulCampo}</span>
              </div>
              <ProgressBar value={xpSulCampo} max={safeXpTotal} color="gold" size="md" />
            </div>
            <div className="flex flex-col gap-[4px] px-[5px]">
              <div className="flex items-center justify-between text-[14px] leading-[20px] text-[#b8b2b3]">
                <span>Reputazione ATCL globale</span>
                <span className="text-white">{reputationGlobal}/100</span>
              </div>
              <ProgressBar value={reputationGlobal} max={100} color="burgundy" size="md" />
            </div>
          </div>

          <div className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[5px] py-[2px] flex flex-col gap-[8px]">
            <p className="text-[18px] leading-[25.2px] font-semibold text-white">
              Reputazione per teatro
            </p>
            <div className="flex flex-col gap-[10px]">
              {theatreReputation.map((theatre) => (
                <div key={theatre.name} className="flex flex-col gap-[4px]">
                  <div className="flex items-center justify-between text-[14px] leading-[20px] text-[#b8b2b3]">
                    <span>{theatre.name}</span>
                    <span className="text-white">{theatre.reputation}/100</span>
                  </div>
                  <ProgressBar value={theatre.reputation} max={100} color="burgundy" size="sm" />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onViewTitoli}
            className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] px-[12px] py-[12px] flex items-center justify-between"
          >
            <div className="flex items-center gap-[12px]">
              <div className="bg-gradient-to-b from-[#e6a23c] to-[#f4bf4f] rounded-[12px] size-[44px] flex items-center justify-center">
                <Award className="text-[#0f0d0e]" size={22} />
              </div>
              <div className="flex flex-col items-start">
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Titoli ottenuti
                </p>
                <p className="text-[14px] leading-[20px] text-[#b8b2b3] !m-0">
                  {achievements.length} badge sbloccati
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[8px]">
              <span className="bg-gradient-to-b from-[#e6a23c] to-[#f4bf4f] rounded-full size-[20px] flex items-center justify-center text-[12px] leading-[16px] text-[#0f0d0e]">
                {newAchievementsCount}
              </span>
              <ChevronRight className="text-[#7a7577]" size={20} />
            </div>
          </button>

          <button
            type="button"
            onClick={onSettings}
            className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] h-[51px] flex items-center justify-between px-[12px]"
          >
            <div className="flex items-center gap-[12px]">
              <Settings className="text-[#f4bf4f]" size={24} />
              <div>
                <p className="text-[18px] leading-[25.2px] font-semibold text-white !m-0">
                  Gestisci account
                </p>
                <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] !m-0">
                  Impostazioni e privacy
                </p>
              </div>
            </div>
            <ChevronRight className="text-[#7a7577]" size={20} />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center justify-center gap-[6px] h-[44px] rounded-md text-[18px] leading-[28px] text-[#ff4d4f]"
          >
            <LogOut size={20} />
            Esci
          </button>
        </div>
      </div>
    </div>
  );
}
