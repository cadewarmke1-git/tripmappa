import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchTrips, migrateLocalTrips } from "../lib/tripsApi.js";
import { SAVED_TRIPS_KEY, readLocalStorage } from "../lib/storageKeys.js";
import { fetchTripCredits } from "../lib/tripCreditsApi.js";
import { TIERS, normalizeTier } from "../lib/tiers.js";
import { runAccountOnboarding } from "../lib/accountOnboardingApi.js";
import { captureReferralFromUrl, getStoredReferralCode, clearStoredReferralCode } from "../lib/referralCapture.js";
import { dismissTrialEndedPrompt } from "../lib/trialApi.js";
import { fetchPlanPreferencesFull } from "../lib/planPreferencesApi.js";
import {
  LazyEmailModal,
  LazyOAuthComingSoonModal,
  LazyPhoneModal,
  LazySignInModal,
} from "../components/LazyModals.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { fetchUserProfile, getGuestHomeAddress, saveTravelerOnboarding } from "../lib/profileApi.js";
import { sendSmsOtp, verifySmsOtp } from "../lib/phoneAuthApi.js";
import {
  fetchUserTripPreferences,
  buildFlowPrefillFromPreferences,
} from "../lib/generationContext.js";

export const SIGNUP_GENERATE_LEAD = "Create a free account to get started — 3 trips on us.";

/**
 * App-level auth UI / session orchestration (modals, credits, profile, founder/trial).
 * Calls AuthContext useAuth internally — does not replace it.
 */
export function useAppAuth({
  toastFnRef,
  theme,
  view,
  setView,
  setHomeAddress,
  setShowUpgradeModal,
  setUpgradeModalReason,
  setFlowPrefill,
  setActiveTripId,
  convoComplete,
  generated,
  questionHistory,
}) {
  const {
    user,
    session,
    signUp,
    signIn,
    signOut,
    resetPassword,
    signInWithOAuth,
    setSessionFromTokens,
    updateEmail,
    updatePassword,
    isConfigured: isAuthConfigured,
    loading: authLoading,
  } = useAuth();

  const [heroEmail, setHeroEmail] = useState("");
  const [authModal, setAuthModal] = useState(null); // signin | signup | phone | oauth-*
  const [authPhone, setAuthPhone] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authModalLead, setAuthModalLead] = useState("");

  const [savedTrips, setSavedTrips] = useState(() => {
    try { return JSON.parse(readLocalStorage(SAVED_TRIPS_KEY) || "[]"); } catch { return []; }
  });
  const savedTripsRef = useRef(savedTrips);
  const [planGenerationCount, setPlanGenerationCount] = useState(0);
  const [creditStatus, setCreditStatus] = useState(null);
  const creditStatusRef = useRef(null);
  const [creditsNeedRefresh, setCreditsNeedRefresh] = useState(0);
  const foundingClaimAttemptedRef = useRef(false);
  const trialPromptShownRef = useRef(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userProfileLoaded, setUserProfileLoaded] = useState(false);
  const [founderWelcomeName, setFounderWelcomeName] = useState(null);
  const planPreferencesRef = useRef({});

  const hadUserRef = useRef(false);
  const intentionalSignOutRef = useRef(false);
  const sessionExpiredNotifiedRef = useRef(false);

  const toast_ = useCallback((msg, options) => {
    return toastFnRef.current?.(msg, options);
  }, [toastFnRef]);

  function applyCreditStatus(next) {
    creditStatusRef.current = next;
    setCreditStatus(next);
  }

  function applySavedTrips(next) {
    savedTripsRef.current = next;
    setSavedTrips(next);
  }

  function prependSavedTrip(saved) {
    if (saved?.id) setActiveTripId(saved.id);
    applySavedTrips([saved, ...savedTripsRef.current.filter(t => t.id !== saved.id)]);
  }

  function applyPlanPreferencesSaved(prefs, meta) {
    planPreferencesRef.current = prefs || {};
    if (meta?.generation_count != null) {
      setPlanGenerationCount(Number(meta.generation_count) || 0);
    }
  }

  const openAuthModal = useCallback((mode, { lead } = {}) => {
    setAuthError("");
    setAuthModalLead(lead || "");
    setAuthModal(mode);
  }, []);

  function closeAuthModal() {
    setAuthModal(null);
    setAuthModalLead("");
  }

  async function handleOAuth(provider) {
    setAuthError("");
    if (!isAuthConfigured) {
      openAuthModal(`oauth-${provider}`);
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setAuthBusy(false);
      setAuthError(err.message || `${provider} sign in failed`);
      openAuthModal(`oauth-${provider}`);
    }
  }

  async function handleEmailSignUp({ email, password }) {
    if (!email?.trim()) {
      setAuthError("Enter your email");
      return;
    }
    if (!password || password.length < 8) {
      setAuthError("Password must be at least 8 characters");
      return;
    }
    if (!isAuthConfigured) {
      toast_("Auth is not configured — add Supabase env vars");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const { session } = await signUp(email, password);
      if (session) {
        toast_("Welcome to TripMappa!", true);
        setAuthModal(null);
        setAuthModalLead("");
        refreshCredits();
      } else {
        toast_("Check your email to confirm your account", true);
        setAuthModal(null);
      }
    } catch (err) {
      setAuthError(err.message || "Sign up failed");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignInSubmit({ email, password }) {
    if (!email?.trim() || !password) {
      setAuthError("Enter email and password");
      return;
    }
    if (!isAuthConfigured) {
      toast_("Auth is not configured — add Supabase env vars");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      await signIn(email, password);
      toast_("Signed in", true);
      setAuthModal(null);
      setAuthModalLead("");
      refreshCredits();
    } catch (err) {
      setAuthError(err.message || "Sign in failed");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword(email) {
    if (!email?.trim()) {
      toast_("Enter your email first");
      return;
    }
    if (!isAuthConfigured) {
      toast_("Auth is not configured — add Supabase env vars");
      return;
    }
    try {
      await resetPassword(email);
      toast_("Password reset email sent — check your inbox", true);
    } catch (err) {
      toast_(err.message || "Could not send reset email");
    }
  }

  async function handlePhoneSendCode(phone) {
    setAuthBusy(true);
    setAuthError("");
    try {
      await sendSmsOtp(phone);
      setAuthPhone(phone);
      toast_("Verification code sent", true);
      return true;
    } catch (err) {
      setAuthError(err.message || "Could not send code");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePhoneVerify(phone, code) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const session = await verifySmsOtp(phone, code);
      await setSessionFromTokens({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      toast_("Signed in", true);
      setAuthModal(null);
      setAuthPhone("");
    } catch (err) {
      setAuthError(err.message || "Could not verify code");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePhoneResend(phone) {
    return handlePhoneSendCode(phone);
  }

  function openLazyPhoneModal() {
    setAuthError("");
    setAuthPhone("");
    setAuthModal("phone");
  }

  function renderAuthModals() {
    return (
      <>
        {authModal === "signup" && (
          <LazyEmailModal
            email={heroEmail}
            onEmailChange={setHeroEmail}
            onClose={closeAuthModal}
            onSignUp={handleEmailSignUp}
            onSwitchToSignIn={() => openAuthModal("signin")}
            onContinueWithPhone={() => { closeAuthModal(); openLazyPhoneModal(); }}
            onGoogle={() => handleOAuth("google")}
            onFacebook={() => handleOAuth("facebook")}
            onApple={() => handleOAuth("apple")}
            loading={authBusy}
            error={authError}
            lead={authModalLead}
            theme={theme}
          />
        )}
        {authModal === "phone" && (
          <LazyPhoneModal
            onClose={() => { setAuthModal(null); setAuthPhone(""); setAuthError(""); }}
            onSendCode={handlePhoneSendCode}
            onVerifyCode={handlePhoneVerify}
            onResendCode={handlePhoneResend}
            initialPhone={authPhone}
            loading={authBusy}
            error={authError}
            theme={theme}
          />
        )}
        {authModal === "signin" && (
          <LazySignInModal
            onClose={() => setAuthModal(null)}
            onSignIn={handleSignInSubmit}
            onForgotPassword={handleForgotPassword}
            onSwitchToSignup={() => openAuthModal("signup")}
            onContinueWithPhone={() => { setAuthModal(null); openLazyPhoneModal(); }}
            onGoogle={() => handleOAuth("google")}
            onFacebook={() => handleOAuth("facebook")}
            onApple={() => handleOAuth("apple")}
            loading={authBusy}
            error={authError}
            theme={theme}
          />
        )}
        {!isAuthConfigured && authModal?.startsWith("oauth-") && (
          <LazyOAuthComingSoonModal
            provider={authModal.replace("oauth-", "")}
            onClose={() => setAuthModal(null)}
            onUseEmail={() => openAuthModal("signup")}
            theme={theme}
          />
        )}
      </>
    );
  }

  async function handleSignOut() {
    intentionalSignOutRef.current = true;
    try {
      await signOut();
      setView("hero");
      setUserProfile(null);
      applyCreditStatus(null);
      toast_("Signed out");
    } catch (err) {
      intentionalSignOutRef.current = false;
      toast_(err.message || "Could not sign out");
    }
  }

  function refreshCredits() {
    if (user && session?.access_token) {
      fetchTripCredits(session.access_token).then(applyCreditStatus).catch(() => {});
    } else {
      applyCreditStatus(null);
    }
  }

  const buildFlowPrefillForUser = useCallback(async () => {
    let tripPrefs = null;
    if (user?.id && session?.access_token) {
      try {
        tripPrefs = await fetchUserTripPreferences(session.access_token);
      } catch {
        tripPrefs = null;
      }
    }
    return buildFlowPrefillFromPreferences(
      planPreferencesRef.current,
      tripPrefs,
      userProfile?.traveler_profile,
    );
  }, [user?.id, session?.access_token, userProfile?.traveler_profile]);

  async function handleTravelerOnboardingComplete(travelerProfile) {
    if (!user?.id) return;
    try {
      const profile = await saveTravelerOnboarding(travelerProfile);
      setUserProfile(profile);
      if (!convoComplete && !generated && questionHistory.length === 0) {
        let tripPrefs = null;
        if (session?.access_token) {
          try {
            tripPrefs = await fetchUserTripPreferences(session.access_token);
          } catch {
            tripPrefs = null;
          }
        }
        setFlowPrefill(buildFlowPrefillFromPreferences(
          planPreferencesRef.current,
          tripPrefs,
          profile?.traveler_profile,
        ));
      }
    } catch (err) {
      console.warn("traveler onboarding save failed:", err);
      toast_("Could not save your preferences — you can set them later in your profile.", { isError: true });
    }
  }

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      try {
        applySavedTrips(JSON.parse(readLocalStorage(SAVED_TRIPS_KEY) || "[]"));
      } catch {
        applySavedTrips([]);
      }
      return undefined;
    }

    setAuthModal(null);
    setAuthBusy(false);

    let cancelled = false;
    (async () => {
      try {
        await migrateLocalTrips(user.id);
        const trips = await fetchTrips(user.id);
        if (!cancelled) applySavedTrips(trips);
      } catch (err) {
        console.warn("Could not load saved trips:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [user, user?.id, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      hadUserRef.current = true;
      sessionExpiredNotifiedRef.current = false;
      return;
    }
    if (hadUserRef.current && !intentionalSignOutRef.current && !sessionExpiredNotifiedRef.current) {
      sessionExpiredNotifiedRef.current = true;
      toast_("Your session expired — please sign in again", {
        actionLabel: "Sign In",
        onAction: () => openAuthModal("signin"),
        duration: 8000,
      });
    }
    intentionalSignOutRef.current = false;
  }, [user, authLoading, toast_, openAuthModal]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.id && session?.access_token) {
      if (typeof window !== "undefined" && window.__TRIPMAPPA_E2E_AUTH__) {
        const mockProfile = window.__TRIPMAPPA_E2E_PROFILE__ || { onboarding_complete: true, tier: "wanderer" };
        const mockCredits = window.__TRIPMAPPA_E2E_CREDITS__ || { tier: "wanderer", unlimited: false, remaining: 3, limit: 3 };
        applyCreditStatus(mockCredits);
        setUserProfile(mockProfile);
        if (mockProfile?.home_address) setHomeAddress(mockProfile.home_address);
        setUserProfileLoaded(true);
        return;
      }
      setUserProfileLoaded(false);
      fetchTripCredits(session.access_token)
        .then(applyCreditStatus)
        .catch(() => applyCreditStatus({ tier: "wanderer", unlimited: false, remaining: 3, limit: 3 }));
      fetchUserProfile()
        .then(profile => {
          if (profile?.home_address) setHomeAddress(profile.home_address);
          setUserProfile(profile);
          setUserProfileLoaded(true);
        })
        .catch(() => {
          setUserProfile(null);
          setUserProfileLoaded(true);
        });
    } else {
      applyCreditStatus(null);
      setUserProfile(null);
      setUserProfileLoaded(true);
      const guestHome = getGuestHomeAddress();
      if (guestHome) setHomeAddress(guestHome);
    }
  }, [user?.id, session?.access_token, authLoading, creditsNeedRefresh, setHomeAddress]);

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  useEffect(() => {
    if (!user?.id || !session?.access_token) {
      planPreferencesRef.current = {};
      setPlanGenerationCount(0);
      return undefined;
    }
    let cancelled = false;
    fetchPlanPreferencesFull(session.access_token)
      .then(({ preferences, meta }) => {
        if (!cancelled) {
          applyPlanPreferencesSaved(preferences, meta);
          if (userProfileLoaded && userProfile?.onboarding_complete === true
            && !convoComplete && !generated && questionHistory.length === 0) {
            buildFlowPrefillForUser().then(setFlowPrefill);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          planPreferencesRef.current = {};
          setPlanGenerationCount(0);
        }
      });
    return () => { cancelled = true; };
  }, [
    user?.id,
    session?.access_token,
    userProfileLoaded,
    userProfile?.traveler_profile,
    userProfile?.onboarding_complete,
    buildFlowPrefillForUser,
    convoComplete,
    generated,
    questionHistory.length,
    setFlowPrefill,
  ]);

  useEffect(() => {
    foundingClaimAttemptedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !session?.access_token) return undefined;
    if (foundingClaimAttemptedRef.current) return undefined;
    foundingClaimAttemptedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const refCode = getStoredReferralCode();
        const result = await runAccountOnboarding(session.access_token, { refCode });
        if (cancelled) return;
        if (result.credits) applyCreditStatus(result.credits);
        const profile = await fetchUserProfile();
        if (!cancelled && profile) setUserProfile(profile);

        if (result.referral?.applied) {
          clearStoredReferralCode();
          toast_("Referral applied. You both received one free month of Voyager.", true);
        }
        if (
          result.credits?.tier === "trailblazer"
          && profile
          && !profile.founder_expires_at
          && !profile.trailblazer_trial_ends_at
          && !result.trialStarted
        ) {
          toast_("Admin access enabled. You have permanent Trailblazer.", true);
        } else if (result.founder?.claimed && !result.founder?.already) {
          const welcomeName = getDisplayName(user, profile).split(" ")[0] || "Explorer";
          setFounderWelcomeName(welcomeName);
        } else if (result.trialStarted) {
          toast_("Your 7-day Trailblazer trial has started.", true);
        }
      } catch {
        /* onboarding optional when DB or slots unavailable */
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, user, user?.id, session?.access_token, toast_]);

  useEffect(() => {
    trialPromptShownRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !session?.access_token) return undefined;
    if (!creditStatus?.showTrialEndedPrompt || trialPromptShownRef.current) return undefined;

    trialPromptShownRef.current = true;
    setUpgradeModalReason("trial-ended");
    setShowUpgradeModal(true);
    dismissTrialEndedPrompt(session.access_token)
      .then(() => setCreditsNeedRefresh(n => n + 1))
      .catch(() => {});

    return undefined;
  }, [authLoading, user?.id, session?.access_token, creditStatus?.showTrialEndedPrompt, setShowUpgradeModal, setUpgradeModalReason]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    if (success !== "1" && success !== "true") return undefined;

    params.delete("success");
    const remainder = params.toString();
    const cleanUrl = `${window.location.pathname}${remainder ? `?${remainder}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);

    setCreditsNeedRefresh(n => n + 1);
    setShowUpgradeModal(false);

    if (authLoading) return undefined;

    if (user?.id && session?.access_token) {
      fetchTripCredits(session.access_token)
        .then(credits => {
          applyCreditStatus(credits);
          const paidTier = normalizeTier(credits?.storedTier ?? credits?.tier);
          if (paidTier === TIERS.VOYAGER) {
            toast_("Welcome to TripMappa Voyager.", true);
          } else if (paidTier === TIERS.TRAILBLAZER) {
            toast_("Welcome to TripMappa Trailblazer.", true);
          }
        })
        .catch(() => {});
      fetchUserProfile()
        .then(profile => {
          if (profile) setUserProfile(profile);
        })
        .catch(() => {});
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token]);

  useEffect(() => {
    if (view === "profile" && !authLoading && !user) {
      setView("app");
      openAuthModal("signin");
    }
  }, [view, user, authLoading, setView, openAuthModal]);

  return {
    user,
    session,
    signUp,
    signIn,
    signOut,
    resetPassword,
    signInWithOAuth,
    setSessionFromTokens,
    updateEmail,
    updatePassword,
    isAuthConfigured,
    authLoading,

    heroEmail,
    setHeroEmail,
    authModal,
    setAuthModal,
    authPhone,
    setAuthPhone,
    authBusy,
    setAuthBusy,
    authError,
    setAuthError,
    authModalLead,
    setAuthModalLead,

    savedTrips,
    savedTripsRef,
    applySavedTrips,
    prependSavedTrip,

    planGenerationCount,
    setPlanGenerationCount,
    creditStatus,
    creditStatusRef,
    applyCreditStatus,
    creditsNeedRefresh,
    setCreditsNeedRefresh,
    refreshCredits,

    userProfile,
    setUserProfile,
    userProfileLoaded,
    setUserProfileLoaded,
    founderWelcomeName,
    setFounderWelcomeName,
    planPreferencesRef,
    applyPlanPreferencesSaved,

    openAuthModal,
    closeAuthModal,
    handleOAuth,
    handleEmailSignUp,
    handleSignInSubmit,
    handleForgotPassword,
    handlePhoneSendCode,
    handlePhoneVerify,
    handlePhoneResend,
    renderAuthModals,
    handleSignOut,
    buildFlowPrefillForUser,
    handleTravelerOnboardingComplete,
  };
}
