import React from 'react';
import { Home, Ticket, ListChecks, User } from 'lucide-react';
import { cn } from './ui/utils';

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
    <nav className="fixed inset-x-0 bottom-0 bg-[#1a1617] border-t border-[#2d2728] z-50">
      <div className="max-w-md mx-auto px-6 pt-2 pb-[calc(env(safe-area-inset-bottom,_0px)+16px)]">
        <div className="grid grid-cols-4 gap-2 items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors text-xs',
                  isActive
                    ? 'text-[#f4bf4f] bg-[#241f20] border border-[#2d2728]'
                    : 'text-[#7a7577] hover:text-[#b8b2b3]'
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
