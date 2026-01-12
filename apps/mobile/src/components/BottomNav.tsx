import React from 'react';
import { Home, ListChecks, Ticket, Trophy, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'home' | 'turni' | 'leaderboard' | 'attivita' | 'profilo';
  onTabChange: (tab: 'home' | 'turni' | 'leaderboard' | 'attivita' | 'profilo') => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'turni' as const, icon: Ticket, label: 'Turni ATCL' },
    { id: 'leaderboard' as const, icon: Trophy, label: 'Classifica' },
    { id: 'attivita' as const, icon: ListChecks, label: 'Attività' },
    { id: 'profilo' as const, icon: User, label: 'Profilo' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full app-nav bg-[#1a1617] border-t border-[#2d2728] z-50">
      <div className="app-content flex items-end justify-between gap-1 h-[72px] px-4 pb-4 pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex h-[44px] flex-1 min-w-0 flex-col items-center justify-end gap-[4px] rounded-[10px] text-[12px] leading-[14px] transition-colors ${
                isActive ? 'text-[#f4bf4f]' : 'text-[#7a7577] hover:text-[#b8b2b3]'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="w-full px-1 text-center truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
