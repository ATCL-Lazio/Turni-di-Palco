import React, { useMemo } from 'react';
import { GameStateProvider, useGameState } from './state/store';
import { NavigatorProvider } from './router';
import { useFeatureGates } from './handlers';
import { AppShell } from './components/AppShell';
import { ThemeProvider } from './providers/ThemeProvider';

function AppWithNavigator() {
  const { events, featureFlags, isFeatureEnabled } = useGameState();
  const { isScreenEnabled, isTabEnabled } = useFeatureGates(featureFlags, isFeatureEnabled);

  const initialEvents = useMemo(() => events.map((event) => ({ id: event.id })), [events]);

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
      <ThemeProvider>
        <AppWithNavigator />
      </ThemeProvider>
    </GameStateProvider>
  );
}
