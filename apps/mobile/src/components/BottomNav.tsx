import React from 'react';
import { Home, ListChecks, ShoppingBag, Trophy, User } from 'lucide-react';
import { Tab } from '../types/navigation';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  enabledTabs?: readonly Tab[];
}

export function BottomNav({ activeTab, onTabChange, enabledTabs }: BottomNavProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'leaderboard' as const, icon: Trophy, label: 'Classifica' },
    { id: 'activities' as const, icon: ListChecks, label: 'Attività' },
    { id: 'shop' as const, icon: ShoppingBag, label: 'Shop' },
    { id: 'profile' as const, icon: User, label: 'Profilo' }
  ];
  const allowedTabs = enabledTabs ? new Set(enabledTabs) : null;
  const visibleTabs = allowedTabs ? tabs.filter((tab) => allowedTabs.has(tab.id)) : tabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full app-nav bg-[#1a1617] border-t border-[#2d2728] z-50">
      <div className="app-content flex items-end justify-between gap-1 h-[72px] px-4 pb-4 pt-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex h-[44px] flex-1 min-w-0 flex-col items-center justify-end gap-[4px] rounded-[10px] text-[12px] leading-[14px] transition-colors ${
                isActive 
                  ? 'text-[#f4bf4f] tab-button-active' 
                  : 'text-[#7a7577] hover:text-[#b8b2b3]'
              }`}
            >
              <Icon 
                size={24} 
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? 'tab-icon-pulse' : ''}
              />
              <span className="w-full px-1 text-center truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
