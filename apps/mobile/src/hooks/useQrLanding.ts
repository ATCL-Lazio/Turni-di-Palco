import { useEffect, useRef } from 'react';
import { INSTALL_DISMISS_KEY, isStandaloneApp } from '../lib/pwa';

export function useQrLanding(_authReady: boolean, _isAuthValid: boolean, onLanding: (target: 'welcome' | 'install') => void) {
    const hasHandledQrLanding = useRef(false);

    useEffect(() => {
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

        if (!isInstalled && !dismissed) {
            onLanding('install');
        } else {
            onLanding('welcome');
        }

        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('from');
            url.searchParams.delete('shortcut');
            window.history.replaceState({}, '', url.toString());
        } catch {
            // ignore
        }
    }, [onLanding]);
}
