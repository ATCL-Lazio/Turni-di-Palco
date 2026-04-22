import React from 'react';
import { BottomNav } from '../components/BottomNav';
import { Tab } from '../types/navigation';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: Tab;
  enabledTabs: readonly Tab[];
  onTabChange: (tab: Tab) => void;
}

export function MainLayout({ children, activeTab, enabledTabs, onTabChange }: MainLayoutProps) {
  return (
    <>
      <div id="main-content" tabIndex={-1} className="app-frame">{children}</div>
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} enabledTabs={enabledTabs} />
    </>
  );
}
