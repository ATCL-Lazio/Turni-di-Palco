import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Screen, ScreenHeader } from '../ui/Screen';
import { Card } from '../ui/Card';
import { achievements } from '../../data/achievements_data';

interface TitoliOttenutiProps {
  onBack: () => void;
}

export function TitoliOttenuti({ onBack }: TitoliOttenutiProps) {
  return (
    <Screen
      header={(
        <ScreenHeader>
          <div className="max-w-md mx-auto">
            <button
              onClick={onBack}
              className="flex items-center gap-2 rounded-md px-2 py-[10px] text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Indietro</span>
            </button>
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-white mb-2">Titoli ottenuti</h2>
            <p className="text-[#b8b2b3]">Tutti i badge sbloccati finora</p>
          </div>
        </ScreenHeader>
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <Card key={achievement.id} className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-2xl flex items-center justify-center">
                <Icon className="text-[#0f0d0e]" size={24} />
              </div>
              <p className="text-xs leading-snug text-[#b8b2b3]">{achievement.title}</p>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
