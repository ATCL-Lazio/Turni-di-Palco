import React from 'react';
import { Home, ListChecks, Ticket, Trophy, User } from 'lucide-react';
import { Tab } from '../types/navigation';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'turns' as const, icon: Ticket, label: 'Turni ATCL' },
    { id: 'leaderboard' as const, icon: Trophy, label: 'Classifica' },
    { id: 'activities' as const, icon: ListChecks, label: 'Attività' },
    { id: 'profile' as const, icon: User, label: 'Profilo' }
  ];

  return (
    <nav className="ios26-functional-layer fixed bottom-0 left-0 right-0 z-50 w-full app-nav px-3">
      <div className="app-content">
        <div className="flex h-[72px] items-end justify-between gap-1 rounded-[26px] border border-white/12 bg-[var(--ios-nav-bg)] px-3 pb-3 pt-2 shadow-[0_16px_34px_-22px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex h-[44px] min-w-0 flex-1 flex-col items-center justify-end gap-[4px] rounded-[12px] px-1 text-[12px] leading-[14px] transition-all duration-150 ${
                isActive 
                  ? 'bg-[#0a84ff]/20 text-[#f2f2f7] shadow-[inset_0_0_0_1px_rgba(90,200,250,0.42)] tab-button-active' 
                  : 'text-[#8e8e93] hover:bg-white/6 hover:text-[#f2f2f7]'
              }`}
            >
              <Icon 
                size={22} 
                strokeWidth={isActive ? 2.35 : 1.95}
                className={isActive ? 'tab-icon-pulse' : ''}
              />
              <span className="w-full px-1 text-center truncate">{tab.label}</span>
            </button>
          );
        })}
        </div>
      </div>
    </nav>
  );
}

