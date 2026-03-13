import React, { useMemo } from 'react';
import { GameStateProvider, useGameState } from './state/store';
import { NavigatorProvider } from './router';
import { useFeatureGates } from './handlers';
import { AppShell } from './components/AppShell';

function AppWithNavigator() {
  const { events, featureFlags, isFeatureEnabled } = useGameState();
  const { isScreenEnabled, isTabEnabled } = useFeatureGates(featureFlags, isFeatureEnabled);

  const initialEvents = useMemo(() => events.map(e => ({ id: e.id })), [events]);

  return (
    <NavigatorProvider
      initialEvents={initialEvents}
      isScreenEnabled={isScreenEnabled}
      isTabEnabled={isTabEnabled}
    >
      <AppShell />
    </NavigatorProvider>
  );
}

export default function App() {
  return (
    <GameStateProvider>
      <AppWithNavigator />
    </GameStateProvider>
  );
}
