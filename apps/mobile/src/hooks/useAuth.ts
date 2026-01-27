import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { resolveDisplayName } from '../lib/profile-utils';
import { PlayerProfile } from '../state/store';

const getEmailPrefix = (value?: string) => value?.split('@')[0]?.trim() ?? '';
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

    const handleLogin = useCallback(async (email: string, password: string) => {
        setAuthError(null);
        if (!isSupabaseConfigured || !supabase) {
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
            updateProfile({ name, email });
            onAuthChange('welcome'); // or role-selection?
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
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

    const handleLogoutAction = useCallback(() => {
        if (supabase) {
            supabase.auth.signOut();
        }
        onLogout();
    }, [onLogout]);

    useEffect(() => {
        if (!supabase) return;
        let mounted = true;

        supabase.auth.getSession().then(({ data, error }) => {
            if (!mounted || error) return;
            if (data.session?.user) {
                const user = data.session.user;
                const displayName = resolveDisplayName({
                    name: user.user_metadata?.name,
                    metadata: user.user_metadata,
                    email: user.email ?? profile.email,
                    fallback: profile.name,
                });
                const email = user.email ?? profile.email;
                const shouldSetName = shouldUpdateName(profile.name, email, displayName);
                updateProfile(shouldSetName ? { name: displayName, email } : { email });
                onAuthChange('home');
            }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            if (event === 'SIGNED_OUT') {
                onLogout();
                return;
            }
            if (event === 'PASSWORD_RECOVERY') {
                if (session?.user) {
                    const displayName = resolveDisplayName({
                        name: session.user.user_metadata?.name,
                        metadata: session.user.user_metadata,
                        email: session.user.email ?? profile.email,
                        fallback: profile.name,
                    });
                    const email = session.user.email ?? profile.email;
                    const shouldSetName = shouldUpdateName(profile.name, email, displayName);
                    updateProfile(shouldSetName ? { name: displayName, email } : { email });
                }
                onAuthChange('change-password', true);
                return;
            }
            if (session?.user) {
                const displayName = resolveDisplayName({
                    name: session.user.user_metadata?.name,
                    metadata: session.user.user_metadata,
                    email: session.user.email ?? profile.email,
                    fallback: profile.name,
                });
                const email = session.user.email ?? profile.email;
                const shouldSetName = shouldUpdateName(profile.name, email, displayName);
                updateProfile(shouldSetName ? { name: displayName, email } : { email });
                onAuthChange('home');
            }
        });

        return () => {
            mounted = false;
            authListener?.subscription.unsubscribe();
        };
    }, [profile.name, profile.email, updateProfile, onAuthChange, onLogout]);

    return {
        authError,
        setAuthError,
        handleLogin,
        handleSignup,
        handleLogout: handleLogoutAction,
    };
}
