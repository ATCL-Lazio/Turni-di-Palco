import { Screen, Tab } from '../types/navigation';

export type RouteLayout = 'main' | 'auth' | 'fullscreen';

export interface RouteConfig {
  screen: Screen;
  layout: RouteLayout;
  tab?: Tab;
  showBottomNav: boolean;
  requiresAuth: boolean;
}

export const routes: RouteConfig[] = [
  // Auth flow
  { screen: 'welcome', layout: 'auth', showBottomNav: false, requiresAuth: false },
  { screen: 'login', layout: 'auth', showBottomNav: false, requiresAuth: false },
  { screen: 'signup', layout: 'auth', showBottomNav: false, requiresAuth: false },
  { screen: 'install', layout: 'auth', showBottomNav: false, requiresAuth: false },
  { screen: 'role-selection', layout: 'auth', showBottomNav: false, requiresAuth: false },

  // Main tabs
  { screen: 'home', layout: 'main', tab: 'home', showBottomNav: true, requiresAuth: true },
  { screen: 'turns', layout: 'main', tab: 'activities', showBottomNav: true, requiresAuth: true },
  { screen: 'activities', layout: 'main', tab: 'activities', showBottomNav: true, requiresAuth: true },
  { screen: 'leaderboard', layout: 'main', tab: 'leaderboard', showBottomNav: true, requiresAuth: true },
  { screen: 'shop', layout: 'main', tab: 'shop', showBottomNav: true, requiresAuth: true },
  { screen: 'profile', layout: 'main', tab: 'profile', showBottomNav: true, requiresAuth: true },

  // Sub-screens with nav
  { screen: 'public-profile', layout: 'main', tab: 'leaderboard', showBottomNav: true, requiresAuth: true },
  { screen: 'career', layout: 'main', tab: 'profile', showBottomNav: true, requiresAuth: true },
  { screen: 'earned-titles', layout: 'main', tab: 'profile', showBottomNav: true, requiresAuth: true },

  // Fullscreen overlays (no bottom nav)
  { screen: 'qr-scanner', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'event-confirmation', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'event-details', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'activity-detail', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'activity-minigame', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'activity-result', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'account-settings', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'support', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'change-password', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },
  { screen: 'ticket-qr-prototype', layout: 'fullscreen', showBottomNav: false, requiresAuth: true },

  // Legal (accessible from both auth and main)
  { screen: 'terms', layout: 'fullscreen', showBottomNav: false, requiresAuth: false },
  { screen: 'privacy', layout: 'fullscreen', showBottomNav: false, requiresAuth: false },
];

const routeMap = new Map(routes.map(r => [r.screen, r]));

export function getRouteConfig(screen: Screen): RouteConfig {
  return routeMap.get(screen) ?? {
    screen,
    layout: 'main',
    showBottomNav: false,
    requiresAuth: true,
  };
}
