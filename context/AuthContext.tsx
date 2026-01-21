import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: any | null; // Add profile to context
    loading: boolean;
    signOut: () => Promise<void>;

    refreshProfile: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },

    refreshProfile: async () => { },
    deleteAccount: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            console.log("Fetching profile for:", userId);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error("Error fetching profile:", error);
            }

            if (data) {
                console.log("Profile data loaded:", data);
                setProfile(data);
            } else {
                console.warn("No profile data found for user:", userId);
            }
        } catch (error) {
            console.error("Exception fetching profile", error);
        }
    };

    const lastRefreshRef = React.useRef<number>(0);
    const accessTokenRef = React.useRef<string | undefined>(undefined);

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                // Check for existing session
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("Error getting session:", error);
                    throw error;
                }

                if (mounted) {
                    if (session) {
                        console.log("Session restored:", session.user.id);
                        accessTokenRef.current = session.access_token;
                        setSession(session);
                        setUser(session.user);
                        fetchProfile(session.user.id);
                    } else {
                        console.log("No active session found.");
                    }
                }
            } catch (error: any) {
                console.error("Auth initialization error:", error);
                // If 429 or invalid token, clean up
                if (error?.status === 429 ||
                    error?.message?.includes("Invalid Refresh Token") ||
                    error?.message?.includes("Refresh Token Not Found") ||
                    error?.code === 'invalid_grant' ||
                    error?.message?.includes("jwks")) {

                    console.warn("Auth Error detected (possible loop), forcing cleanup...", error);
                    // @ts-ignore
                    window.lastAuthError = error;
                    await forceCleanup();
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth State Change:", event);

            if (event === 'SIGNED_IN' && session) {
                if (mounted) {
                    accessTokenRef.current = session.access_token;
                    setSession(session);
                    setUser(session.user);
                    fetchProfile(session.user.id);
                }
            } else if (event === 'SIGNED_OUT') {
                if (mounted) {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                }
                await clearLocalSession();
            } else if (event === 'TOKEN_REFRESHED') {
                // 1. Check for duplicate token (Event Echo)
                if (session?.access_token === accessTokenRef.current) {
                    // console.log("Blocking duplicate TOKEN_REFRESHED event");
                    return;
                }

                // 2. Debounce: Ignore if updated less than 2s ago
                const now = Date.now();
                if (now - lastRefreshRef.current < 2000) {
                    console.warn("Rapid refresh detected. Ignoring event to maintain session stability.");
                    return;
                }
                lastRefreshRef.current = now;

                console.log("Processing legitimate token refresh");
                if (mounted) {
                    accessTokenRef.current = session?.access_token;
                    setSession(session);
                    setUser(session?.user ?? null);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const clearLocalSession = async () => {
        // 1. Clear Supabase local storage manually
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
                console.log("Cleared token:", key);
            }
        });
    };

    const forceCleanup = async () => {
        await clearLocalSession();
        await supabase.auth.signOut().catch(() => { });
        setSession(null);
        setUser(null);
        setProfile(null);
    };

    const signOut = async () => {
        setLoading(true);
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        } finally {
            await clearLocalSession();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
        }
    };



    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const deleteAccount = async () => {
        try {
            const { error } = await supabase.rpc('delete_user_account');
            if (error) throw error;
            await signOut();
        } catch (error) {
            console.error("Error deleting account:", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile, deleteAccount }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
