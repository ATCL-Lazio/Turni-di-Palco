import { useEffect, useRef } from 'react';
import { isStandaloneApp } from '../lib/pwa';

export function useQrLanding(_authReady: boolean, _isAuthValid: boolean, onLanding: (target: 'welcome' | 'install') => void) {
    const hasHandledQrLanding = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (hasHandledQrLanding.current) return;

        const search = new URLSearchParams(window.location.search);
        const isFromQr = search.get('from') === 'qr';
        const isInstalled = isStandaloneApp();

        if (!isFromQr && isInstalled) return;

        if (!isInstalled) {
            hasHandledQrLanding.current = true;
            onLanding('install');
        }

        try {
            if (isFromQr) {
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch {
            // ignore
        }
    }, [onLanding]);
}
