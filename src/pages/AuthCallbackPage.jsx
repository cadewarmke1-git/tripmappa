import { useEffect, useRef } from "react";
import PulsingWordmark from "../components/PulsingWordmark.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

function hasAuthCallbackParams() {
  const search = new URLSearchParams(window.location.search);
  if (search.get("code") || search.get("error")) return true;
  const hash = window.location.hash?.replace(/^#/, "") || "";
  if (!hash) return false;
  const hashParams = new URLSearchParams(hash);
  return Boolean(
    hashParams.get("access_token")
    || hashParams.get("error")
    || hashParams.get("error_description"),
  );
}

export default function AuthCallbackPage() {
  const { theme } = useTheme();
  const finishedRef = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      window.location.replace("/");
    };

    if (!isSupabaseConfigured() || !supabase) {
      finish();
      return undefined;
    }

    let subscription;
    let timeoutId;

    const confirmSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) finish();
    };

    const run = async () => {
      try {
        const search = new URLSearchParams(window.location.search);
        const code = search.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await confirmSession();
          return;
        }

        if (hasAuthCallbackParams()) {
          await confirmSession();
          if (finishedRef.current) return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          finish();
          return;
        }

        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (
            nextSession
            && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
          ) {
            finish();
          }
        });
        subscription = sub;

        timeoutId = window.setTimeout(finish, 10_000);
      } catch {
        finish();
      }
    };

    run();

    return () => {
      subscription?.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className="auth-callback-page"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Signing you in"
    >
      <PulsingWordmark size="lg" centered />
    </div>
  );
}
