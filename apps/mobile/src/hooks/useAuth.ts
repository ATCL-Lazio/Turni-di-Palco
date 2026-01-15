import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PlayerProfile } from '../state/store';

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

        const name = data.user?.user_metadata?.name ?? profile.name;
        updateProfile({ name, email });
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

        const displayName = data.user?.user_metadata?.name ?? name;
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
                const displayName = user.user_metadata?.name ?? profile.name;
                updateProfile({ name: displayName, email: user.email ?? profile.email });
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
                    const displayName = session.user.user_metadata?.name ?? profile.name;
                    updateProfile({ name: displayName, email: session.user.email ?? profile.email });
                }
                onAuthChange('change-password', true);
                return;
            }
            if (session?.user) {
                const displayName = session.user.user_metadata?.name ?? profile.name;
                updateProfile({ name: displayName, email: session.user.email ?? profile.email });
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
