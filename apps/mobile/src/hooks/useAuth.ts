import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { resolveDisplayName } from '../lib/profile-utils';
import { PlayerProfile, suppressSignedInNavigation } from '../state/store';

const getEmailPrefix = (value?: string) => value?.split('@')[0]?.trim() ?? '';

const GENERIC_AUTH_ERROR = 'Impossibile completare la richiesta. Riprova più tardi.';
const GENERIC_CREDENTIALS_ERROR = 'Credenziali non valide.';
const GENERIC_RATE_LIMIT_ERROR = 'Troppi tentativi. Riprova tra qualche minuto.';
const GENERIC_NETWORK_ERROR = 'Errore di connessione. Controlla la rete e riprova.';
const GENERIC_PASSWORD_POLICY_ERROR = 'La password non soddisfa i requisiti richiesti.';
const GENERIC_EMAIL_FORMAT_ERROR = 'Indirizzo email non valido.';

const translateAuthError = (error: { message?: string | null; status?: number | null } | null | undefined): string => {
    if (!error) return GENERIC_AUTH_ERROR;
    const raw = (error.message ?? '').toLowerCase();
    const status = typeof error.status === 'number' ? error.status : null;

    if (raw.includes('network') || raw.includes('fetch') || raw.includes('failed to fetch')) {
        return GENERIC_NETWORK_ERROR;
    }
    if (raw.includes('rate limit') || status === 429) {
        return GENERIC_RATE_LIMIT_ERROR;
    }
    if (raw.includes('password') && (raw.includes('short') || raw.includes('weak') || raw.includes('should be at least') || raw.includes('characters'))) {
        return GENERIC_PASSWORD_POLICY_ERROR;
    }
    if (raw.includes('invalid email') || raw.includes('email address')) {
        return GENERIC_EMAIL_FORMAT_ERROR;
    }
    // All credential / user-state failures collapse to a single generic message
    // so the response does not leak whether an account exists.
    if (
        raw.includes('invalid login') ||
        raw.includes('invalid credentials') ||
        raw.includes('user not found') ||
        raw.includes('user already registered') ||
        raw.includes('already registered') ||
        raw.includes('email not confirmed') ||
        status === 400 ||
        status === 401 ||
        status === 422
    ) {
        return GENERIC_CREDENTIALS_ERROR;
    }
    return GENERIC_AUTH_ERROR;
};
const resolveAuthRedirectTo = () => {
    const fromEnv = import.meta.env.VITE_AUTH_REDIRECT_TO;
    if (typeof fromEnv === 'string' && fromEnv.trim()) {
        return fromEnv.trim();
    }
    if (typeof window === 'undefined') return undefined;
    const origin = window.location.origin?.trim();
    if (!origin) return undefined;
    const pathname = window.location.pathname || '/';
    return `${origin}${pathname}`;
};
const shouldUpdateName = (currentName: string, email: string | undefined, nextName: string) => {
    const trimmedCurrent = currentName?.trim() ?? '';
    if (!trimmedCurrent) return true;
    const emailPrefix = getEmailPrefix(email);
    if (!emailPrefix) return false;
    const trimmedNext = nextName?.trim() ?? '';
    return trimmedCurrent === emailPrefix && trimmedNext && trimmedNext !== trimmedCurrent;
};

export function useAuth(
    profile: PlayerProfile,
    updateProfile: (updates: Partial<PlayerProfile>) => void,
    onAuthChange: (screen: 'home' | 'welcome' | 'change-password', isRecovery?: boolean) => void,
    onLogout: () => void
) {
    const [authError, setAuthError] = useState<string | null>(null);
    const [isDemoMode, setIsDemoMode] = useState(false);

    const handleLogin = useCallback(async (email: string, password: string) => {
        setAuthError(null);
        if (!isSupabaseConfigured || !supabase) {
            setIsDemoMode(true);
            updateProfile({ email });
            onAuthChange('home');
            return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setAuthError(translateAuthError(error));
            return;
        }

        if (!data.session || !data.user) {
            // No session returned — email confirmation may still be pending.
            setAuthError('Controlla la tua email per confermare l\'account prima di accedere.');
            return;
        }

        const displayName = resolveDisplayName({
            name: data.user?.user_metadata?.name,
            metadata: data.user?.user_metadata,
            email,
            fallback: profile.name,
        });
        const shouldSetName = shouldUpdateName(profile.name, email, displayName);
        updateProfile(shouldSetName ? { name: displayName, email } : { email });
        // Navigation to 'home' is handled by the onAuthStateChange SIGNED_IN listener;
        // calling onAuthChange here as well would fire it twice on every successful login.
    }, [profile.name, updateProfile]);

    const handleSignup = useCallback(async (name: string, email: string, password: string, isMinor = false) => {
        setAuthError(null);
        if (!isSupabaseConfigured || !supabase) {
            setIsDemoMode(true);
            updateProfile({ name, email });
            onAuthChange('welcome'); // Flow will continue to role-selection
            return;
        }

        const redirectTo = resolveAuthRedirectTo();
        signupInProgressRef.current = true;
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                // is_minor viene letto dal trigger handle_new_user che, per i
                // minorenni, imposta leaderboard_visible=false (classifica opt-in).
                data: { name, is_minor: isMinor },
                ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
            },
        });
        if (error) {
            signupInProgressRef.current = false;
            setAuthError(translateAuthError(error));
            return;
        }

        // When email confirmation is required, data.session is null — the user
        // has not signed in yet. Show a "check your email" message and stop.
        if (!data.session) {
            signupInProgressRef.current = false;
            setAuthError('Registrazione quasi completata! Controlla la tua email per confermare l\'account.');
            return;
        }

        // Supabase returns identities: [] when the email is already registered
        // (deliberate enumeration protection). Treat as a generic credentials error.
        if (!data.user?.identities?.length) {
            signupInProgressRef.current = false;
            setAuthError(GENERIC_CREDENTIALS_ERROR);
            return;
        }

        const displayName = resolveDisplayName({
            name: data.user?.user_metadata?.name ?? name,
            metadata: data.user?.user_metadata,
            email,
            fallback: name,
        });
        updateProfile({ name: displayName, email });
        onAuthChange('welcome'); // Flow will continue to role-selection
        // signupInProgressRef is cleared by the SIGNED_IN listener below.
    }, [onAuthChange, updateProfile]);

    // Set to true immediately before a voluntary signOut so the SIGNED_OUT
    // listener can skip the misleading "session expired" error message.
    const isVoluntaryLogoutRef = useRef(false);

    // Set to true immediately before supabase.auth.signUp() so the SIGNED_IN
    // listener does not overwrite the 'welcome' navigation with 'home' when
    // Supabase returns an immediate session (fixes #1445).
    const signupInProgressRef = useRef(false);

    const handleLogoutAction = useCallback(async () => {
        setAuthError(null);
        if (supabase) {
            try {
                isVoluntaryLogoutRef.current = true;
                await supabase.auth.signOut();
                // onLogout() will be called by the SIGNED_OUT listener;
                // do NOT call it here to avoid the double-fire.
            } catch {
                // signOut failure must not block local logout.
                isVoluntaryLogoutRef.current = false;
                onLogout();
            }
        } else {
            // Demo mode / no Supabase: no auth listener fires, call directly.
            onLogout();
        }
    }, [onLogout]);

    const profileNameRef = useRef(profile.name);
    const profileEmailRef = useRef(profile.email);
    useEffect(() => { profileNameRef.current = profile.name; }, [profile.name]);
    useEffect(() => { profileEmailRef.current = profile.email; }, [profile.email]);

    const applyUserProfileFromAuth = useCallback(
        (
            user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined,
            options?: {
                fallbackName?: string;
                navigateTo?: 'home' | 'change-password';
                isRecovery?: boolean;
            },
        ) => {
            if (!user) {
                return;
            }

            const email = user.email ?? profileEmailRef.current;
            const displayName = resolveDisplayName({
                name: (user.user_metadata?.name as string | undefined),
                metadata: user.user_metadata,
                email,
                fallback: options?.fallbackName ?? profileNameRef.current,
            });

            const shouldSetName = shouldUpdateName(profileNameRef.current, email, displayName);
            updateProfile(shouldSetName ? { name: displayName, email } : { email });

            if (options?.navigateTo) {
                onAuthChange(options.navigateTo, options.isRecovery);
            }
        },
        [updateProfile, onAuthChange],
    );

    const applyUserProfileRef = useRef(applyUserProfileFromAuth);
    useEffect(() => { applyUserProfileRef.current = applyUserProfileFromAuth; }, [applyUserProfileFromAuth]);

    const onLogoutRef = useRef(onLogout);
    useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

    // Guard: only navigate to 'home' on the very first successful getUser()
    // resolution (the auth-unknown → authenticated transition). Subsequent
    // calls (hot-reload, StrictMode double-mount, component remount) must NOT
    // redirect the user away from their current screen (closes #1315).
    const hasNavigatedRef = useRef(false);

    useEffect(() => {
        if (!supabase) return;
        let mounted = true;

        supabase.auth.getUser().then(({ data, error }) => {
            if (!mounted || error || !data.user) return;
            const navigateTo = hasNavigatedRef.current ? undefined : 'home';
            hasNavigatedRef.current = true;
            applyUserProfileRef.current(data.user, {
                navigateTo,
            });
        }).catch(() => undefined);

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            if (event === 'SIGNED_OUT') {
                // Only show the "session expired" message for involuntary
                // sign-outs (e.g. token revoked by server). Voluntary logouts
                // (initiated via handleLogoutAction) set isVoluntaryLogoutRef
                // before calling signOut() so we skip the misleading banner.
                if (!isVoluntaryLogoutRef.current) {
                    setAuthError('Sessione scaduta. Effettua nuovamente l\'accesso.');
                }
                isVoluntaryLogoutRef.current = false;
                onLogoutRef.current();
                return;
            }
            if (event === 'PASSWORD_RECOVERY') {
                applyUserProfileRef.current(session?.user, {
                    navigateTo: 'change-password',
                    isRecovery: true,
                });
                return;
            }
            if (session?.user) {
                // Only navigate on an explicit sign-in transition.
                // TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION refresh
                // the profile without interrupting the current screen.
                // Skip navigation when the SIGNED_IN event comes from a
                // credential-verification sign-in inside changePassword (flag
                // set in store.tsx) to prevent spurious redirect to 'home'.
                // Also skip when signup is in progress: handleSignup already
                // navigated to 'welcome' for role-selection onboarding; the
                // SIGNED_IN event must not overwrite that with 'home' (#1445).
                const isSignupEvent = signupInProgressRef.current;
                if (isSignupEvent) signupInProgressRef.current = false;
                const navigateTo =
                    event === 'SIGNED_IN' && !suppressSignedInNavigation && !isSignupEvent
                        ? 'home'
                        : undefined;
                applyUserProfileRef.current(session.user, {
                    navigateTo,
                });
            }
        });

        return () => {
            mounted = false;
            authListener?.subscription.unsubscribe();
        };
    }, []);

    // Exposed so callers (e.g. deleteAccount in AppShell) can set the flag
    // before triggering a signOut that was not initiated through handleLogout.
    const markVoluntaryLogout = useCallback(() => {
        isVoluntaryLogoutRef.current = true;
    }, []);

    // Exposed so callers can reset the flag if signOut fails and no SIGNED_OUT
    // event fires (which would normally reset it at useAuth.ts:245). Without
    // this, the ref stays true and the next involuntary session expiry would
    // be silently suppressed (issue #1124).
    const unmarkVoluntaryLogout = useCallback(() => {
        isVoluntaryLogoutRef.current = false;
    }, []);

    return {
        authError,
        setAuthError,
        isDemoMode,
        handleLogin,
        handleSignup,
        handleLogout: handleLogoutAction,
        markVoluntaryLogout,
        unmarkVoluntaryLogout,
    };
}
