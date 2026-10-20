import React from 'react';
import { BottomNav } from '../components/BottomNav';
import { Tab } from '../types/navigation';

interface MainLayoutProps {
  /** Albero della schermata (eventuali transizioni/Suspense sono a carico del chiamante). */
  children: React.ReactNode;
  showBottomNav: boolean;
  activeTab: Tab;
  enabledTabs: readonly Tab[];
  onTabChange: (tab: Tab) => void;
}

/**
 * Frame principale: `#main-content` (target dello skip link) e, se la rotta lo
 * prevede, la bottom nav come sibling. La nav resta fuori da wrapper animati e
 * da Suspense, così rimane fissa e montata durante i cambi schermata.
 */
export function MainLayout({ children, showBottomNav, activeTab, enabledTabs, onTabChange }: MainLayoutProps) {
  return (
    <>
      <div id="main-content" tabIndex={-1} className="app-frame">{children}</div>
      {showBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} enabledTabs={enabledTabs} />
      )}
    </>
  );
}
