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

  const activeIndex = visibleTabs.findIndex((t) => t.id === activeTab);
  const numTabs = visibleTabs.length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full app-nav z-50">
      <div className="bg-[#0f0d0e]/90 backdrop-blur-2xl border-t border-white/[0.05]">
        <div className="relative app-content flex items-stretch justify-around px-2 pt-1 pb-[calc(env(safe-area-inset-bottom,_0px)+4px)] min-h-[54px]">

          {/* Sliding gold indicator line */}
          {activeIndex >= 0 && (
            <div
              className="absolute top-0 h-[2px] bg-[#f4bf4f] rounded-full"
              style={{
                width: `calc(100% / ${numTabs} - 20px)`,
                left: `calc(${activeIndex} * (100% / ${numTabs}) + 10px)`,
                transition: 'left 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          )}

          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-1 min-w-0 flex-col items-center justify-center gap-[3px] py-1 rounded-xl transition-colors duration-150 ${
                  isActive
                    ? 'text-[#f4bf4f] tab-button-active'
                    : 'text-[#3d393a] hover:text-[#7a7577] active:text-[#b8b2b3]'
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive ? 'tab-icon-pulse' : ''}
                />
                <span className="text-[9.5px] leading-none tracking-[0.02em] font-medium w-full px-1 text-center truncate">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
