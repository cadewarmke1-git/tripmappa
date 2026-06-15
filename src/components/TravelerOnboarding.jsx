import { useEffect, useState } from "react";
import {
  TRAVELER_DIETARY_OPTIONS,
  TRAVELER_STOPS_INTEREST_GROUPS,
} from "../lib/travelerPreferenceOptions.js";
import PreferencePillGrid, { PreferencePillGroups, togglePreferenceValue } from "./PreferencePillGrid.jsx";
import "../styles/traveler-onboarding.css";
import "../styles/preference-pills.css";

const WORDMARK = "TripMappa";
const WORDMARK_LETTER_STAGGER_MS = 62.5;
const PREFERENCE_STEPS = ["dietary", "stops_interests"];

export default function TravelerOnboarding({ onComplete }) {
  const [screen, setScreen] = useState("welcome");
  const [screenPhase, setScreenPhase] = useState("enter");
  const [showGetStarted, setShowGetStarted] = useState(false);
  const [dietary, setDietary] = useState([]);
  const [foodAllergies, setFoodAllergies] = useState("");
  const [stopsInterests, setStopsInterests] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (screen !== "welcome") return undefined;
    setShowGetStarted(false);
    const timer = setTimeout(() => setShowGetStarted(true), 1500);
    return () => clearTimeout(timer);
  }, [screen]);

  function buildProfile() {
    return {
      dietary: [...dietary],
      food_allergies: foodAllergies.trim(),
      stops_interests: [...stopsInterests],
    };
  }

  function transitionTo(nextScreen) {
    setScreenPhase("exit");
    window.setTimeout(() => {
      setScreen(nextScreen);
      setScreenPhase("enter");
    }, 300);
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

  function handleDietaryContinue() {
    transitionTo("stops_interests");
  }

  function handleDietarySkip() {
    transitionTo("stops_interests");
  }

  const preferenceStepIndex = PREFERENCE_STEPS.indexOf(screen);

  return (
    <div className="traveler-onboarding" role="dialog" aria-modal="true">
      {screen !== "welcome" && (
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
        {screen === "welcome" && (
          <div className="traveler-onboarding-welcome">
            <h1 className="traveler-onboarding-wordmark" aria-label="TripMappa">
              {WORDMARK.split("").map((letter, index) => (
                <span
                  key={`${letter}-${index}`}
                  className="traveler-onboarding-wordmark-letter"
                  style={{ animationDelay: `${index * WORDMARK_LETTER_STAGGER_MS}ms` }}
                >
                  {letter}
                </span>
              ))}
            </h1>
            <p className="traveler-onboarding-tagline">Travel Reimagined.</p>
            <button
              type="button"
              className={`btn-generate traveler-onboarding-get-started${showGetStarted ? " is-visible" : ""}`}
              onClick={handleWelcomeStart}
            >
              Get Started
            </button>
          </div>
        )}

        {screen === "dietary" && (
          <div className="traveler-onboarding-panel-screen">
            <header className="traveler-onboarding-screen-header">
              <h2 id="traveler-onboarding-title" className="traveler-onboarding-title">
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
              <h2 className="traveler-onboarding-title">What do you love stopping for?</h2>
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
    </div>
  );
}
