import { useEffect, useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { configurePlacesAutocomplete } from "../lib/places.js";
import { getTierLabel, TIERS } from "../lib/tiers.js";

const SETTINGS_ITEMS = [
  {
    id: "notifications",
    label: "Notification preferences",
    detail: "Trip reminders and product updates",
  },
  {
    id: "vehicle",
    label: "Vehicle defaults",
    detail: "Default vehicle, fuel, and towing for new plans",
  },
  {
    id: "dietary",
    label: "Dietary preferences",
    detail: "Food and stop defaults for the planner",
  },
  {
    id: "home",
    label: "Home address",
    detail: "Used for Head home and Navigate Home",
  },
  {
    id: "billing",
    label: "Subscription and billing",
    detail: "Plan, renewals, and payment method",
  },
  {
    id: "accounts",
    label: "Connected accounts",
    detail: "Sign-in methods linked to TripMappa",
  },
];

export default function SettingsPage({
  user,
  profile,
  creditStatus = null,
  isLoaded = false,
  onBack,
  onOpenPreferences,
  onSaveHomeAddress,
  onSaveNotifications,
  onManageSubscription,
  onOpenPricing,
  toast,
}) {
  const [panel, setPanel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingHome, setEditingHome] = useState(false);
  const [homeDraft, setHomeDraft] = useState(profile?.home_address || "");
  const [notifyTripReminders, setNotifyTripReminders] = useState(
    profile?.notify_trip_reminders !== false,
  );
  const [notifyNewFeatures, setNotifyNewFeatures] = useState(
    profile?.notify_new_features !== false,
  );
  const homeInputRef = useRef(null);

  useEffect(() => {
    setHomeDraft(profile?.home_address || "");
  }, [profile?.home_address]);

  useEffect(() => {
    setNotifyTripReminders(profile?.notify_trip_reminders !== false);
    setNotifyNewFeatures(profile?.notify_new_features !== false);
  }, [profile?.notify_trip_reminders, profile?.notify_new_features]);

  const tierName = getTierLabel(creditStatus?.tier || profile?.tier || TIERS.WANDERER);
  const activeItem = SETTINGS_ITEMS.find(item => item.id === panel) || null;

  async function handleNotifyChange(tripReminders, newFeatures) {
    setNotifyTripReminders(tripReminders);
    setNotifyNewFeatures(newFeatures);
    try {
      await onSaveNotifications?.({
        notifyTripReminders: tripReminders,
        notifyNewFeatures: newFeatures,
      });
    } catch {
      toast?.("Could not save notification preferences");
    }
  }

  async function handleSaveHome() {
    const value = (homeInputRef.current?.value || homeDraft).trim();
    if (!value) return;
    setSaving(true);
    try {
      await onSaveHomeAddress?.(value);
      setEditingHome(false);
      toast?.("Home address saved", true);
    } catch (err) {
      toast?.(err?.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  }

  function openPreferencesPanel() {
    onOpenPreferences?.();
  }

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <button
          type="button"
          className="settings-page-back"
          onClick={() => {
            if (panel) setPanel(null);
            else onBack?.();
          }}
        >
          ← {panel ? "Settings" : "Back"}
        </button>
        <h1 className="settings-page-title">{activeItem ? activeItem.label : "Settings"}</h1>
      </header>

      {!panel && (
        <nav className="settings-hub" aria-label="Settings">
          {SETTINGS_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className="settings-hub-row"
              onClick={() => {
                if (item.id === "vehicle" || item.id === "dietary") {
                  openPreferencesPanel();
                  return;
                }
                setPanel(item.id);
                setEditingHome(false);
              }}
            >
              <span className="settings-hub-copy">
                <span className="settings-hub-label">{item.label}</span>
                <span className="settings-hub-detail">{item.detail}</span>
              </span>
              <span className="settings-hub-chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </nav>
      )}

      {panel === "notifications" && (
        <section className="settings-panel">
          <p className="settings-panel-lead">Choose which emails TripMappa can send you.</p>
          <div className="settings-toggle-group">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={notifyTripReminders}
                onChange={e => handleNotifyChange(e.target.checked, notifyNewFeatures)}
              />
              <span>Trip reminders</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={notifyNewFeatures}
                onChange={e => handleNotifyChange(notifyTripReminders, e.target.checked)}
              />
              <span>New features & updates</span>
            </label>
          </div>
        </section>
      )}

      {panel === "home" && (
        <section className="settings-panel">
          <p className="settings-panel-lead">Used by Head home and Navigate Home after a long drive.</p>
          {editingHome ? (
            <div className="settings-field">
              {isLoaded ? (
                <Autocomplete
                  onLoad={ac => configurePlacesAutocomplete(ac)}
                  onPlaceChanged={() => {
                    if (homeInputRef.current) setHomeDraft(homeInputRef.current.value);
                  }}
                  options={{ types: ["geocode", "establishment"] }}
                >
                  <input
                    ref={homeInputRef}
                    className="settings-input"
                    defaultValue={homeDraft}
                    placeholder="Street address or city"
                    aria-label="Home address"
                  />
                </Autocomplete>
              ) : (
                <input
                  ref={homeInputRef}
                  className="settings-input"
                  value={homeDraft}
                  onChange={e => setHomeDraft(e.target.value)}
                  placeholder="Street address or city"
                  aria-label="Home address"
                />
              )}
              <div className="settings-actions">
                <button type="button" className="settings-btn settings-btn--primary" onClick={handleSaveHome} disabled={saving}>
                  Save
                </button>
                <button type="button" className="settings-btn" onClick={() => setEditingHome(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-value-row">
              <span>{profile?.home_address || "No home address saved yet"}</span>
              <button type="button" className="settings-link" onClick={() => setEditingHome(true)}>
                {profile?.home_address ? "Edit" : "Add"}
              </button>
            </div>
          )}
        </section>
      )}

      {panel === "billing" && (
        <section className="settings-panel">
          <p className="settings-panel-lead">Manage your TripMappa plan and billing.</p>
          <div className="settings-billing-card">
            <div className="settings-billing-tier">{tierName}</div>
            {creditStatus?.remaining != null && !creditStatus?.unlimited && (
              <p className="settings-billing-meta">
                {creditStatus.remaining} of {creditStatus.limit} trips remaining
              </p>
            )}
            {creditStatus?.unlimited && (
              <p className="settings-billing-meta">Unlimited trip planning</p>
            )}
          </div>
          <div className="settings-actions settings-actions--stack">
            {typeof onManageSubscription === "function" && (
              <button type="button" className="settings-btn settings-btn--primary" onClick={onManageSubscription}>
                Manage subscription
              </button>
            )}
            {typeof onOpenPricing === "function" && (
              <button type="button" className="settings-btn" onClick={onOpenPricing}>
                Plans and pricing
              </button>
            )}
          </div>
        </section>
      )}

      {panel === "accounts" && (
        <section className="settings-panel">
          <p className="settings-panel-lead">Accounts used to sign in to TripMappa.</p>
          <ul className="settings-account-list">
            <li className="settings-account-row">
              <span className="settings-account-label">Email</span>
              <span className="settings-account-value">{user?.email || "Not set"}</span>
            </li>
            <li className="settings-account-row settings-account-row--muted">
              <span className="settings-account-label">Google</span>
              <span className="settings-account-value">Coming soon</span>
            </li>
            <li className="settings-account-row settings-account-row--muted">
              <span className="settings-account-label">Apple</span>
              <span className="settings-account-value">Coming soon</span>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
