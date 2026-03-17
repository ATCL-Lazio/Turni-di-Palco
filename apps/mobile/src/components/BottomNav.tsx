import React, { useMemo } from 'react';
import { Home, ListChecks, ShoppingBag, Trophy, User } from 'lucide-react';
import { Tab } from '../types/navigation';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  enabledTabs?: readonly Tab[];
}

const TAB_CONFIG = [
  { id: 'home' as const, icon: Home, label: 'Home' },
  { id: 'leaderboard' as const, icon: Trophy, label: 'Classifica' },
  { id: 'activities' as const, icon: ListChecks, label: 'Attività' },
  { id: 'shop' as const, icon: ShoppingBag, label: 'Shop' },
  { id: 'profile' as const, icon: User, label: 'Profilo' },
] as const;

const BOTTOM_NAV_PADDING_STYLE: React.CSSProperties = {
  paddingBottom: 'calc(4px + env(safe-area-inset-bottom, 0px))',
};

export function BottomNav({ activeTab, onTabChange, enabledTabs }: BottomNavProps) {
  const visibleTabs = useMemo(() => {
    if (!enabledTabs) return TAB_CONFIG;
    const allowed = new Set(enabledTabs);
    return TAB_CONFIG.filter(tab => allowed.has(tab.id));
  }, [enabledTabs]);

  const activeIndex = visibleTabs.findIndex(t => t.id === activeTab);
  const numTabs = visibleTabs.length;

  const indicatorStyle = activeIndex >= 0 ? {
    width: `calc(100% / ${numTabs} - 20px)`,
    left: `calc(${activeIndex} * (100% / ${numTabs}) + 10px)`,
    transition: 'left 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  } : undefined;

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-50 bg-[#0f0d0e]/90 backdrop-blur-2xl border-t border-white/[0.05]">
      <div className="relative app-content flex items-stretch justify-around px-2 pt-1 min-h-[54px]" style={BOTTOM_NAV_PADDING_STYLE}>

          {indicatorStyle && (
            <div
              className="absolute top-0 h-[2px] bg-[#f4bf4f] rounded-full"
              style={indicatorStyle}
            />
          )}

          {visibleTabs.map(tab => (
            <TabButton
              key={tab.id}
              id={tab.id}
              icon={tab.icon}
              label={tab.label}
              isActive={activeTab === tab.id}
              onPress={onTabChange}
            />
          ))}
      </div>
    </nav>
  );
}

interface TabButtonProps {
  id: Tab;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  isActive: boolean;
  onPress: (tab: Tab) => void;
}

const TabButton = React.memo(function TabButton({ id, icon: Icon, label, isActive, onPress }: TabButtonProps) {
  return (
    <button
      onClick={() => onPress(id)}
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
        {label}
      </span>
    </button>
  );
});
