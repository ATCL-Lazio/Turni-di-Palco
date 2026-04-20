import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { resolveDisplayName } from '../lib/profile-utils';
import { PlayerProfile } from '../state/store';

const getEmailPrefix = (value?: string) => value?.split('@')[0]?.trim() ?? '';
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
            setAuthError(error.message);
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
        onAuthChange('home');
    }, [onAuthChange, profile.name, updateProfile]);

    const handleSignup = useCallback(async (name: string, email: string, password: string) => {
        setAuthError(null);
        if (!isSupabaseConfigured || !supabase) {
            setIsDemoMode(true);
            updateProfile({ name, email });
            onAuthChange('welcome'); // Flow will continue to role-selection
            return;
        }

        const redirectTo = resolveAuthRedirectTo();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
                ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
            },
        });
        if (error) {
            setAuthError(error.message);
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
    }, [onAuthChange, updateProfile]);

    const handleLogoutAction = useCallback(async () => {
        setAuthError(null);
        if (supabase) {
            try {
                await supabase.auth.signOut();
            } catch {
                // signOut failure must not block local logout
            }
        }
        onLogout();
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

    useEffect(() => {
        if (!supabase) return;
        let mounted = true;

        supabase.auth.getSession().then(({ data, error }) => {
            if (!mounted || error) return;
            if (data.session?.user) {
                applyUserProfileRef.current(data.session.user, {
                    navigateTo: 'home',
                });
            }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            if (event === 'SIGNED_OUT') {
                setAuthError('Sessione scaduta. Effettua nuovamente l\'accesso.');
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
                const navigateTo = event === 'SIGNED_IN' ? 'home' : undefined;
                applyUserProfileRef.current(session.user, {
                    navigateTo,
                });
            }
        });

        return () => {
            mounted = false;
            authListener?.subscription.unsubscribe();
        };
    }, [applyUserProfileFromAuth, onLogout]);

    return {
        authError,
        setAuthError,
        isDemoMode,
        handleLogin,
        handleSignup,
        handleLogout: handleLogoutAction,
    };
}
