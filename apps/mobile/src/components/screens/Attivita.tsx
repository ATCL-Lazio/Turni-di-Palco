import React from 'react';
import { Clock, Coins, Play, TrendingUp } from 'lucide-react';
import { Activity } from '../../state/store';

interface AttivitaProps {
  activities: Activity[];
  onStartActivity: (activityId: string) => void;
}

const difficultyLabels: Record<Activity['difficulty'], string> = {
  Facile: 'Principiante',
  Medio: 'Intermedio',
  Difficile: 'Avanzato'
};

export function Attivita({ activities, onStartActivity }: AttivitaProps) {
  return (
    <div
      className="min-h-screen bg-[#0f0d0e]"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
    >
      <div className="w-full max-w-[393px] mx-auto pt-[36px] pb-0 mt-[17px] flex flex-col gap-[24px]">
        <div className="flex flex-col items-start px-[25px]">
          <p className="text-[24px] leading-[31.2px] font-bold tracking-[-0.24px] text-white">
            Attività simulate
          </p>
          <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
            Migliora le tue skill e guadagna ricompense
          </p>
        </div>

        <div className="flex flex-col gap-[20px] items-start px-[25px]">
          <div className="bg-[#1a1617] border border-[rgba(244,191,79,0.3)] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] w-[325px] p-px">
            <div className="flex h-[76px] items-center justify-center px-[5px] py-[4px]">
              <div className="flex flex-col items-start">
                <p className="text-[18px] leading-[25.2px] font-semibold text-white">
                  Allenati ogni giorno
                </p>
                <p className="text-[14px] leading-[25.6px] text-[#b8b2b3] w-[319px]">
                  Completa le attività per migliorare le tue competenze e prepararti per gli eventi reali
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[25px] items-start">
            <p className="text-[20px] leading-[28px] font-semibold text-white">
              Attività disponibili
            </p>

            <div className="flex flex-col gap-[20px] items-start">
              {activities.map((activity) => {
                const difficultyLabel = difficultyLabels[activity.difficulty] ?? activity.difficulty;
                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => onStartActivity(activity.id)}
                    className="bg-[#1a1617] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] p-[5px] w-[291px] text-left"
                  >
                    <div className="flex gap-[16px] items-start">
                      <div className="bg-gradient-to-b from-[#a82847] to-[#6b1529] rounded-[16.4px] size-[56px] flex items-center justify-center">
                        <Play className="text-[#f4bf4f]" size={24} />
                      </div>
                      <div className="flex-1 flex flex-col items-start">
                        <div className="flex w-full items-start justify-between">
                          <p className="text-[18px] leading-[25.2px] font-semibold text-white">
                            {activity.title}
                          </p>
                          <Play className="text-[#f4bf4f]" size={20} />
                        </div>
                        <p className="text-[16px] leading-[25.6px] text-[#b8b2b3]">
                          {activity.description}
                        </p>
                        <div className="flex gap-[12px] items-center h-[20px] text-[14px] leading-[20px] text-[#b8b2b3]">
                          <Clock size={14} />
                          <span>{activity.duration}</span>
                          <span>{difficultyLabel}</span>
                        </div>
                        <div className="flex gap-[8px] items-start h-[16px]">
                          <span className="flex items-center gap-[4px] h-[16px] rounded-full bg-gradient-to-b from-[#e6a23c] to-[#f4bf4f] px-[6px] text-[12px] leading-[16px] text-[#0f0d0e]">
                            <TrendingUp size={12} />
                            +{activity.xpReward} XP
                          </span>
                          <span className="flex items-center gap-[4px] h-[16px] rounded-full bg-[#241f20] px-[6px] text-[12px] leading-[16px] text-[#b8b2b3]">
                            <Coins size={12} />
                            +
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-[#1a1617] border border-[#2d2728] rounded-[16.4px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] w-[291px] p-px">
              <div className="flex flex-col items-center justify-center h-[68px]">
                <p className="text-[16px] leading-[25.6px] text-[#7a7577]">Nuove attività in arrivo</p>
                <p className="text-[16px] leading-[25.6px] text-[#b8b2b3] text-center w-[266px]">
                  Stiamo preparando nuove sfide e minigames
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
