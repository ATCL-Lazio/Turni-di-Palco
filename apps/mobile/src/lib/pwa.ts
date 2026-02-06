export const INSTALL_DISMISS_KEY = 'tdp-install-dismissed';

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (typeof nav.standalone === 'boolean') return nav.standalone;

  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}
