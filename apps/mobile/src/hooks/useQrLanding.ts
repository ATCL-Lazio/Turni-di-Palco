import { useEffect, useRef } from 'react';

export function useQrLanding(authReady: boolean, isAuthValid: boolean, onLanding: (target: 'welcome' | 'install') => void) {
    const hasHandledQrLanding = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (hasHandledQrLanding.current) return;

        const search = new URLSearchParams(window.location.search);
        if (search.get('from') !== 'qr') return;
        if (!authReady) return;

        hasHandledQrLanding.current = true;
        onLanding(isAuthValid ? 'install' : 'welcome');

        try {
            window.history.replaceState({}, '', window.location.pathname);
        } catch {
            // ignore
        }
    }, [authReady, isAuthValid, onLanding]);
}
