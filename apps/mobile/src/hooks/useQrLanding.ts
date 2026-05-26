import { useEffect, useRef } from 'react';
import { INSTALL_DISMISS_KEY, isStandaloneApp } from '../lib/pwa';

export function useQrLanding(
    authReady: boolean,
    isAuthValid: boolean,
    isOnboarded: boolean,
    onLanding: (target: 'welcome' | 'home' | 'install' | 'role-selection') => void,
) {
    const hasHandledQrLanding = useRef(false);

    useEffect(() => {
        // Wait for auth state to be resolved before making any routing decision.
        // Without this guard the effect can fire before the Supabase session is
        // restored, locking hasHandledQrLanding to true with stale auth state.
        if (!authReady) return;
        if (typeof window === 'undefined') return;
        if (hasHandledQrLanding.current) return;

        const search = new URLSearchParams(window.location.search);
        const isFromQr = search.get('from') === 'qr';
        const isShortcutQr = search.get('shortcut') === 'qr';
        const shouldHandle = isFromQr || isShortcutQr;

        if (!shouldHandle) return;

        hasHandledQrLanding.current = true;

        const isInstalled = isStandaloneApp();
        const dismissed = window.sessionStorage.getItem(INSTALL_DISMISS_KEY) === '1';

        // Auth/onboarding checks take precedence over the install prompt so that
        // authenticated onboarded users arriving via QR are never incorrectly
        // bounced to the install screen (closes #1134).
        if (!isOnboarded) {
            // New user arriving via QR deep-link: skip first mission, just choose role.
            // Show install prompt first if the app is not installed.
            if (!isInstalled && !dismissed) {
                onLanding('install');
            } else {
                onLanding('role-selection');
            }
        } else if (!isAuthValid) {
            // Onboarded user with an expired/missing session: send to login screen
            // so they can re-authenticate before reaching the protected home screen.
            onLanding('welcome');
        } else if (!isInstalled && !dismissed) {
            // Onboarded, authenticated user on a non-installed browser: prompt install.
            onLanding('install');
        } else {
            // Onboarded user with a valid session arriving via QR: go directly to home
            onLanding('home');
        }

        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('from');
            url.searchParams.delete('shortcut');
            window.history.replaceState({}, '', url.toString());
        } catch {
            // ignore
        }
    }, [authReady, isAuthValid, isOnboarded, onLanding]);
}
