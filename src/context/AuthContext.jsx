import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

/*
 * OAuth branding (Google sign-in consent screen)
 * ─────────────────────────────────────────────
 * If users see your Supabase project URL instead of "TripMappa":
 *
 * 1) Supabase Dashboard → Authentication → URL Configuration
 *    - Site URL: https://tripmappa.com
 *    - Redirect URLs: https://tripmappa.com/** and http://localhost:5173/** (dev)
 *
 * 2) Supabase Dashboard → Authentication → Providers → Google
 *    - Ensure the Google client ID/secret match your Google Cloud OAuth client.
 *
 * 3) Google Cloud Console → APIs & Services → OAuth consent screen
 *    - Open: https://console.cloud.google.com/apis/credentials/consent
 *    - App name: TripMappa  ← must match exactly; this is what users see on the consent screen
 *    - User support email: your support address
 *    - App logo: upload the TripMappa logo (120×120 px recommended)
 *    - Application home page: https://tripmappa.com
 *    - Authorized domains: tripmappa.com and your Supabase project domain (*.supabase.co)
 *    - Click SAVE at the bottom — changes do not apply until saved
 *    - If the app is in "Testing", add test users or publish to Production when ready
 *
 * 4) Google Cloud Console → Credentials → OAuth 2.0 Client (Web application)
 *    - Authorized JavaScript origins: https://tripmappa.com, http://localhost:5173
 *    - Authorized redirect URIs: https://<project-ref>.supabase.co/auth/v1/callback
 *
 * Also set SITE_URL=https://tripmappa.com in Vercel env for production share links.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.__TRIPMAPPA_E2E_AUTH__) {
      const e2eUser = { id: "e2e-user", email: "e2e@tripmappa.test" };
      setUser(e2eUser);
      setSession({ access_token: "e2e-token", user: e2eUser });
      setLoading(false);
      return undefined;
    }

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
      const { error: globalError } = await supabase.auth.signOut({ scope: "global" });
      if (globalError) {
        const { error: localError } = await supabase.auth.signOut({ scope: "local" });
        if (localError) throw localError;
      }
      setSession(null);
      setUser(null);
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
          redirectTo: "https://tripmappa.com/auth/callback",
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
    async updateEmail(email) {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
    },
    async updatePassword(password) {
      if (!supabase) throw new Error("Supabase is not configured");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
  }), [user, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
