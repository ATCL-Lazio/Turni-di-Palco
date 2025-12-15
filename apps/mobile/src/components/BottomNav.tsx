import React from 'react';
import { Home, Ticket, ListChecks, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'home' | 'turni' | 'attivita' | 'profilo';
  onTabChange: (tab: 'home' | 'turni' | 'attivita' | 'profilo') => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'turni' as const, icon: Ticket, label: 'Turni ATCL' },
    { id: 'attivita' as const, icon: ListChecks, label: 'Attività' },
    { id: 'profilo' as const, icon: User, label: 'Profilo' }
  ];
  
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#1a1617] border-t border-[#2d2728] z-50 flex flex-col justify-end items-center"
      style={{ padding: '20px 0' }}
    >
      <div className="max-w-md mx-auto flex justify-around items-center px-3 py-2">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          let buttonMargin = '0 20px';
          if (index === 0) buttonMargin = '0 20px 0 auto';
          if (index === tabs.length - 1) buttonMargin = '0 auto 0 20px';

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all duration-200 ${
                isActive ? 'text-[#f4bf4f]' : 'text-[#7a7577] hover:text-[#b8b2b3]'
              }`}
              style={{ margin: buttonMargin, justifyContent: index === 0 ? 'flex-end' : 'unset' }}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
