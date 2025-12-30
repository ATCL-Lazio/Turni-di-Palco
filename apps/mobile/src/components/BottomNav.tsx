import React from 'react';
import { Home, ListChecks, Ticket, User } from 'lucide-react';

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
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1a1617] border-t border-[#2d2728] z-50">
      <div className="mx-auto flex items-end justify-center h-[80px] pb-[20px] pt-px">
        <div className="flex items-center justify-between w-[280px]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex h-[44px] w-[70px] min-w-[70px] flex-col items-center justify-end gap-[4px] rounded-[10px] text-[12px] leading-[14px] transition-colors ${
                  isActive ? 'text-[#f4bf4f]' : 'text-[#7a7577] hover:text-[#b8b2b3]'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-center whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
