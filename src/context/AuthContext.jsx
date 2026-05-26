import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isConfigured: isSupabaseConfigured(),
    async signUp(email, password) {
      if (!supabase) throw new Error("Supabase is not configured");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      return data;
    },
    async signIn(email, password) {
      if (!supabase) throw new Error("Supabase is not configured");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      return data;
    },
    async signOut() {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    async resetPassword(email) {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
    },
    async signInWithOAuth(provider) {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
          skipBrowserRedirect: false,
        },
      });
      if (error) throw error;
    },
    async setSessionFromTokens({ access_token, refresh_token }) {
      if (!supabase) throw new Error("Supabase is not configured");
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      return data;
    },
  }), [user, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
