import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useDialogA11y } from "../hooks/useDialogA11y.js";
import {
  TRAVELER_DIETARY_OPTIONS,
  TRAVELER_STOPS_INTEREST_GROUPS,
} from "../lib/travelerPreferenceOptions.js";
import PreferencePillGrid, { PreferencePillGroups, togglePreferenceValue } from "./PreferencePillGrid.jsx";
import "../styles/traveler-onboarding.css";

const HERO_DAY_PHOTO = "/hero/open-road-golden-hour.png";
const HERO_NIGHT_PHOTO = "/hero/open-road-twilight.png";
const PREFERENCE_STEPS = ["dietary", "stops_interests"];

export default function TravelerOnboarding({ onComplete }) {
  const { theme } = useTheme();
  const { signOut } = useAuth();
  const themeMode = theme === "day" ? "day" : "night";

  const [screen, setScreen] = useState("welcome");
  const [screenPhase, setScreenPhase] = useState("enter");
  const [dietary, setDietary] = useState([]);
  const [dietaryOther, setDietaryOther] = useState("");
  const [foodAllergies, setFoodAllergies] = useState("");
  const [stopsInterests, setStopsInterests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [photosFailed, setPhotosFailed] = useState(false);

  function buildProfile() {
    const diet = [...dietary];
    const other = dietaryOther.trim();
    if (other && !diet.includes(other)) diet.push(other);
    return {
      dietary: diet,
      food_allergies: foodAllergies.trim(),
      stops_interests: [...stopsInterests],
    };
  }

  function transitionTo(nextScreen) {
    setScreen(nextScreen);
    setScreenPhase("enter");
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await onComplete(buildProfile());
    } finally {
      setBusy(false);
    }
  }

  function handleWelcomeStart() {
    transitionTo("dietary");
  }

  async function handleSignIn() {
    try {
      await signOut();
    } catch {
      /* return to hero for sign-in even if sign-out fails */
    }
    window.location.href = "/";
  }

  function handleDietaryContinue() {
    transitionTo("stops_interests");
  }

  function handleDietarySkip() {
    transitionTo("stops_interests");
  }

  const preferenceStepIndex = PREFERENCE_STEPS.indexOf(screen);
  const isWelcome = screen === "welcome";
  const dialogRef = useDialogA11y(true, undefined, "traveler-onboarding-dialog-title");

  return (
    <dialog
      ref={dialogRef}
      className={`traveler-onboarding traveler-onboarding--${themeMode}${isWelcome ? " traveler-onboarding--welcome-screen" : ""}${photosFailed ? " traveler-onboarding--photos-failed" : ""}`}
      aria-labelledby="traveler-onboarding-dialog-title"
    >
      {!isWelcome && (
        <div className="traveler-onboarding-dots" aria-hidden="true">
          {PREFERENCE_STEPS.map((stepId, index) => (
            <span
              key={stepId}
              className={`traveler-onboarding-dot${preferenceStepIndex === index ? " is-active" : ""}${preferenceStepIndex > index ? " is-complete" : ""}`}
            />
          ))}
        </div>
      )}

      <div className={`traveler-onboarding-stage traveler-onboarding-stage--${screenPhase}`}>
        {isWelcome && (
          <div className="traveler-onboarding-welcome">
            <div className="traveler-onboarding-welcome-bg" aria-hidden="true">
              <div className="traveler-onboarding-bg-fallback" />
              <img
                className="traveler-onboarding-photo traveler-onboarding-photo--day"
                src={HERO_DAY_PHOTO}
                alt=""
                decoding="async"
                onError={() => setPhotosFailed(true)}
              />
              <img
                className="traveler-onboarding-photo traveler-onboarding-photo--night"
                src={HERO_NIGHT_PHOTO}
                alt=""
                decoding="async"
                onError={() => setPhotosFailed(true)}
              />
              <div className="traveler-onboarding-scrim" />
            </div>

            <div className="traveler-onboarding-welcome-content">
              <p className="traveler-onboarding-kicker">Welcome to</p>
              <div className="traveler-onboarding-road-dash" aria-hidden="true" />
              <h1 id="traveler-onboarding-dialog-title" className="traveler-onboarding-wordmark" aria-label="TripMappa">
                <span className="traveler-onboarding-wordmark-trip">Trip</span>
                <span className="traveler-onboarding-wordmark-mappa">Mappa</span>
              </h1>
              <p className="traveler-onboarding-tagline">Your trip, our mission.</p>
              <p className="traveler-onboarding-lead">
                Plan the perfect road trip with curated stops, smart routing, and the open road ahead.
              </p>
              <button
                type="button"
                className="traveler-onboarding-get-started"
                onClick={handleWelcomeStart}
              >
                Get started →
              </button>
              <p className="traveler-onboarding-signin">
                Already rolling?{" "}
                <button type="button" className="traveler-onboarding-signin-link" onClick={handleSignIn}>
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}

        {screen === "dietary" && (
          <div className="traveler-onboarding-panel-screen">
            <header className="traveler-onboarding-screen-header">
              <h2 id="traveler-onboarding-dialog-title" className="traveler-onboarding-title">
                What are your food preferences?
              </h2>
              <p className="traveler-onboarding-subtitle">
                We&apos;ll keep this in mind for every trip.
              </p>
            </header>
            <div className="traveler-onboarding-scroll">
              <PreferencePillGrid
                options={TRAVELER_DIETARY_OPTIONS}
                selected={dietary}
                onToggle={value => setDietary(prev => togglePreferenceValue(prev, value))}
              />
              <label className="traveler-onboarding-field">
                <span className="preference-pill-group-label">Other (optional)</span>
                <input
                  type="text"
                  className="traveler-onboarding-input"
                  placeholder="Any other dietary preference…"
                  value={dietaryOther}
                  onChange={e => setDietaryOther(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="traveler-onboarding-field">
                <span className="preference-pill-group-label">Food allergies (optional)</span>
                <input
                  type="text"
                  className="traveler-onboarding-input"
                  placeholder="e.g. peanuts, shellfish, dairy…"
                  value={foodAllergies}
                  onChange={e => setFoodAllergies(e.target.value)}
                />
              </label>
            </div>
            <div className="traveler-onboarding-actions">
              <button
                type="button"
                className="btn-generate traveler-onboarding-continue"
                disabled={busy}
                onClick={handleDietaryContinue}
              >
                Continue
              </button>
              <button
                type="button"
                className="traveler-onboarding-skip"
                disabled={busy}
                onClick={handleDietarySkip}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {screen === "stops_interests" && (
          <div className="traveler-onboarding-panel-screen">
            <header className="traveler-onboarding-screen-header">
              <h2 id="traveler-onboarding-dialog-title" className="traveler-onboarding-title">What do you love stopping for?</h2>
              <p className="traveler-onboarding-subtitle">
                We&apos;ll suggest stops that match your style.
              </p>
            </header>
            <div className="traveler-onboarding-scroll">
              <PreferencePillGroups
                groups={TRAVELER_STOPS_INTEREST_GROUPS}
                selected={stopsInterests}
                onToggle={value => setStopsInterests(prev => togglePreferenceValue(prev, value))}
              />
            </div>
            <div className="traveler-onboarding-actions">
              <button
                type="button"
                className="btn-generate traveler-onboarding-continue"
                disabled={busy}
                onClick={finish}
              >
                Continue
              </button>
              <button
                type="button"
                className="traveler-onboarding-skip"
                disabled={busy}
                onClick={finish}
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
