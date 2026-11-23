import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { withMobileWatchdog, WatchdogTimeoutError } from '../../services/mobile-watchdog';
import { MOBILE_WATCHDOG_TIMEOUTS } from '../constants';
import { persistStoredSession, readStoredSession } from '../persistence';

export type AuthSessionState = {
  authUserId: string | null;
  authReady: boolean;
};

/**
 * Ripristina la sessione Supabase all'avvio e segue onAuthStateChange.
 * `authReady` diventa true quando si sa se l'utente è autenticato o no.
 */
export function useAuthSession(): AuthSessionState {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    const restoreSession = async () => {
      await withMobileWatchdog(
        async () => {
          const stored = readStoredSession();
          if (stored) {
            // Legacy duplicate token copy (already removed from storage by
            // readStoredSession): use it only if supabase-js has no session.
            const { data: existing } = await supabase!.auth.getSession();
            if (!existing.session) {
              const { data: restoredData, error: restoreError } = await supabase!.auth.setSession({
                access_token: stored.access_token,
                refresh_token: stored.refresh_token,
              });
              if (restoreError || !restoredData.session) {
                persistStoredSession(null);
                await supabase!.auth.signOut();
              }
            }
          }

          const { data } = await supabase!.auth.getSession();
          if (!isMounted) return;

          let stableSession = data.session ?? null;
          if (stableSession?.access_token) {
            const { error: userError } = await supabase!.auth.getUser(stableSession.access_token);
            if (userError) {
              stableSession = null;
              persistStoredSession(null);
              await supabase!.auth.signOut();
            }
          }

          // Guard again after the async getUser/signOut calls — the component
          // may have unmounted (e.g. StrictMode double-mount) while they were in
          // flight (closes #1354).
          if (!isMounted) return;

          persistStoredSession(stableSession);
          setAuthUserId(stableSession?.user.id ?? null);
          setAuthReady(true);
        },
        {
          operation: 'restoreSession',
          timeoutMs: MOBILE_WATCHDOG_TIMEOUTS.restoreSession,
          title: 'Ripristino sessione lento',
          message: 'Il ripristino della sessione mobile sta impiegando troppo tempo.',
        }
      );
    };

    let authReadyFallbackId: number | null = null;

    restoreSession().catch((err) => {
      console.error('[restoreSession] unexpected error', err);
      // For WatchdogTimeoutError: withMobileWatchdog already showed the error
      // overlay; the in-flight Supabase call continues and will trigger
      // onAuthStateChange (below) which sets both authUserId and authReady
      // correctly — setting authReady=true here without authUserId would
      // produce a phantom logged-out state window (closes #1527).
      if (isMounted && !(err instanceof WatchdogTimeoutError)) {
        setAuthReady(true);
      }
      // Safety net: on total network failure the in-flight Supabase call never
      // completes, so onAuthStateChange never fires and authReady stays false
      // forever. Fall back to ready after an additional wait so the app
      // eventually becomes usable even without connectivity (closes #1587).
      if (err instanceof WatchdogTimeoutError) {
        authReadyFallbackId = window.setTimeout(() => {
          if (isMounted) setAuthReady(true);
        }, 30_000);
      }
    });

    const { data: authListener } = supabase!.auth.onAuthStateChange((_event, session) => {
      if (authReadyFallbackId !== null) {
        window.clearTimeout(authReadyFallbackId);
        authReadyFallbackId = null;
      }
      persistStoredSession(session ?? null);
      if (!isMounted) return;
      setAuthUserId(session?.user.id ?? null);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      if (authReadyFallbackId !== null) window.clearTimeout(authReadyFallbackId);
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return { authUserId, authReady };
}
