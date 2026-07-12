import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { computeTripStats, getTripVehicle } from "../lib/tripStats.js";
import DecorMark from "./icons/DecorMark.jsx";
import RouteMapThumbnail from "./RouteMapThumbnail.jsx";
import {
  TRAILBLAZER_BENEFITS,
  VOYAGER_BENEFITS,
  TIERS,
  getTierLabel,
  getTierPriceLabel,
  isFounderTier,
  normalizeTier,
  getTierCssClass,
} from "../lib/tiers.js";
import PricingPlans from "./PricingPlans.jsx";

function formatMemberSince(dateStr) {
  if (!dateStr) return "Recently joined";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return "Recently joined";
  }
}

function formatRenewalDate(dateStr) {
  if (!dateStr) return "Managed via Stripe";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "Managed via Stripe";
  }
}

function TierBadge({ tier }) {
  if (isFounderTier(tier)) {
    return (
      <span className="profile-tier-badge profile-tier-badge-founder">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Founder
      </span>
    );
  }
  const normalized = normalizeTier(tier);
  const tierClass = getTierCssClass(tier);
  const showStar = normalized === TIERS.VOYAGER || normalized === TIERS.TRAILBLAZER;
  return (
    <span className={`profile-tier-badge profile-tier-badge-${tierClass}`}>
      {showStar && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      )}
      {getTierLabel(normalized)}
    </span>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="profile-stat-card">
      <div className="profile-stat-value">{value}</div>
      <div className="profile-stat-label">{label}</div>
    </div>
  );
}

function SavedTripCard({ trip, onLoad, onDelete }) {
  const vehicle = getTripVehicle(trip);
  const stopCount = (trip.stops?.length || 0) + (trip.roadStops?.length || 0);
  const from = trip.origin?.split(",")[0]?.trim() || trip.origin;
  const to = trip.dest?.split(",")[0]?.trim() || trip.dest;
  const routeName = from && to ? `${from} → ${to}` : (trip.origin || trip.dest || "Saved route");

  return (
    <div className="profile-trip-card">
      <RouteMapThumbnail routePoints={trip.routeInfo?.routePoints} className="profile-trip-card-thumb" />
      <div className="profile-trip-card-content">
        <div className="profile-trip-card-route">
          <div className="profile-trip-card-name">{routeName}</div>
        </div>
        <div className="profile-trip-card-meta">
          <span>{trip.date || "—"}</span>
          <span>{stopCount} stop{stopCount !== 1 ? "s" : ""}</span>
          <span className="profile-trip-card-vehicle">{vehicle}</span>
          {trip.routeInfo?.distance && <span>{trip.routeInfo.distance}</span>}
        </div>
        <div className="profile-trip-card-actions">
          <button type="button" className="profile-btn profile-btn-secondary" onClick={() => onLoad(trip)}>
            Resume trip
          </button>
          <button type="button" className="profile-btn profile-btn-danger" onClick={() => onDelete(trip.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({
  user,
  profile,
  creditStatus,
  savedTrips,
  generationCount = 0,
  isLoaded,
  onBack,
  onSignOut,
  onUpgrade,
  onUpgradeVoyager,
  onUpgradeTraveler,
  onPlanTrip,
  onLoadTrip,
  onDeleteTrip,
  onSaveDisplayName,
  onSaveHomeAddress,
  onSaveEmergencyContact,
  onSaveNotifications,
  onUploadAvatar,
  onUpdateEmail,
  onUpdatePassword,
  onManageSubscription,
  onOpenPreferences,
  toast,
  scrollToSection = null,
}) {
  const fileRef = useRef(null);
  const homeInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [editingHome, setEditingHome] = useState(false);
  const [editingEmergency, setEditingEmergency] = useState(false);
  const [homeDraft, setHomeDraft] = useState("");
  const [emergencyDraft, setEmergencyDraft] = useState("");
  const [notifyTripReminders, setNotifyTripReminders] = useState(true);
  const [notifyNewFeatures, setNotifyNewFeatures] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState("month");

  const displayName = getDisplayName(user, profile);
  const rawTier = creditStatus?.tier || profile?.tier;
  const isFounder = isFounderTier(rawTier) || creditStatus?.isFounder;
  const tier = normalizeTier(rawTier);
  const isTrailblazer = tier === TIERS.TRAILBLAZER;
  const isVoyager = tier === TIERS.VOYAGER;
  const memberSince = formatMemberSince(user?.created_at || profile?.created_at);
  const stats = useMemo(() => computeTripStats(savedTrips), [savedTrips]);
  const hideTripUsage = Boolean(creditStatus?.isAdmin);
  const used = creditStatus?.used ?? 0;
  const limit = creditStatus?.limit ?? 3;
  const progressPct = creditStatus?.unlimited ? 100 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const monthlyUsageLabel = creditStatus?.billingPeriod === "monthly" && !creditStatus?.unlimited
    ? `${used} of ${limit} Trip Generations used this month`
    : null;

  function startEditName() {
    setDisplayNameDraft(displayName);
    setEditingName(true);
  }

  function startEditEmail() {
    setEmailDraft(user?.email || "");
    setEditingEmail(true);
  }

  function startEditHome() {
    setHomeDraft(profile?.home_address || "");
    setEditingHome(true);
  }

  function startEditEmergency() {
    setEmergencyDraft(profile?.emergency_contact_phone || "");
    setEditingEmergency(true);
  }

  async function handleSaveEmergency() {
    const trimmed = emergencyDraft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSaveEmergencyContact(trimmed);
      setEditingEmergency(false);
      toast?.("Emergency contact saved", true);
    } catch (err) {
      toast?.(err.message || "Could not save emergency contact");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      toast?.("Choose a JPG, PNG, or WebP image");
      return;
    }
    setUploading(true);
    try {
      await onUploadAvatar(file);
      toast?.("Profile photo updated", true);
    } catch (err) {
      toast?.(err.message || "Could not upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveName() {
    const trimmed = displayNameDraft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSaveDisplayName(trimmed);
      setEditingName(false);
      toast?.("Display name saved", true);
    } catch (err) {
      toast?.(err.message || "Could not save name");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEmail() {
    const trimmed = emailDraft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onUpdateEmail(trimmed);
      setEditingEmail(false);
      toast?.("Check your inbox to confirm your new email", true);
    } catch (err) {
      toast?.(err.message || "Could not update email");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePassword() {
    if (passwordDraft.length < 8) {
      toast?.("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await onUpdatePassword(passwordDraft);
      setPasswordDraft("");
      setEditingPassword(false);
      toast?.("Password updated", true);
    } catch (err) {
      toast?.(err.message || "Could not update password");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveHome() {
    const value = (homeInputRef.current?.value || homeDraft).trim();
    if (!value) return;
    setSaving(true);
    try {
      await onSaveHomeAddress(value);
      setEditingHome(false);
      toast?.("Home address saved", true);
    } catch (err) {
      toast?.(err.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  }

  async function handleNotifyChange(tripReminders, newFeatures) {
    setNotifyTripReminders(tripReminders);
    setNotifyNewFeatures(newFeatures);
    try {
      await onSaveNotifications({ notifyTripReminders: tripReminders, notifyNewFeatures: newFeatures });
    } catch {
      toast?.("Could not save notification preferences");
    }
  }

  useEffect(() => {
    if (profile) {
      setNotifyTripReminders(profile.notify_trip_reminders !== false);
      setNotifyNewFeatures(profile.notify_new_features !== false);
    }
  }, [profile?.notify_trip_reminders, profile?.notify_new_features]);

  useEffect(() => {
    if (!scrollToSection) return undefined;
    const targetId = scrollToSection === "settings"
      ? "profile-settings"
      : scrollToSection === "plans"
        ? "profile-plans"
        : null;
    if (!targetId) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [scrollToSection]);

  return (
    <div className="profile-page">
      <div className="profile-header-banner">
        <button type="button" className="profile-back-btn" onClick={onBack}>← Back</button>
        <div className="profile-header-inner">
          <div className="profile-photo-wrap">
            <UserAvatar
              user={user}
              profile={profile}
              size="xl"
              showRing
              tierRing={getTierCssClass(rawTier)}
              className="profile-photo"
            />
            <button
              type="button"
              className="profile-photo-camera"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Upload profile photo"
            >
              {uploading ? "…" : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8"/>
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarChange} />
          </div>
          <h1 className="profile-display-name">{displayName}</h1>
          <p className="profile-member-since">Member since {memberSince}</p>
          <p className="profile-generation-count">
            {generationCount} trip{generationCount === 1 ? "" : "s"} generated
          </p>
          <TierBadge tier={rawTier} />
        </div>
      </div>

      <div className="profile-body">
        <section className="profile-stats-bar" aria-label="Trip statistics">
          <StatCard value={stats.totalTrips} label="Trips Planned" />
          <StatCard value={stats.milesPlanned.toLocaleString()} label="Miles Planned" />
          <StatCard value={stats.statesVisited} label="States Visited" />
          <StatCard value={stats.favoriteVehicle} label="Favorite Vehicle" />
        </section>

        <section id="profile-plans" className="profile-card profile-plan-card">
          <h2 className="profile-section-title">Current Plan</h2>
          {isFounder ? (
            <>
              <div className="profile-plan-header">
                <TierBadge tier={TIERS.FOUNDER} />
                <span className="profile-plan-renewal profile-plan-founder-tag">
                  Founder Member — 1 of 1,000 limited spots
                  {creditStatus?.founderExpiresAt && (
                    <> · Trailblazer access until {formatRenewalDate(creditStatus.founderExpiresAt)}</>
                  )}
                </span>
              </div>
              <p className="profile-plan-founder-explainer">
                You received one year of Trailblazer free as an early member. Your Founder badge stays on your profile permanently.
              </p>
              <ul className="profile-benefits-list">
                {TRAILBLAZER_BENEFITS.map(b => <li key={b}>{b}</li>)}
              </ul>
            </>
          ) : isTrailblazer ? (
            <>
              <div className="profile-plan-header">
                <TierBadge tier={TIERS.TRAILBLAZER} />
                <span className="profile-plan-renewal">
                  {getTierPriceLabel(TIERS.TRAILBLAZER)} · Renews {formatRenewalDate(profile?.premium_renewal_at)}
                </span>
              </div>
              {!hideTripUsage && monthlyUsageLabel && (
                <span className="profile-plan-usage">{monthlyUsageLabel}</span>
              )}
              <ul className="profile-benefits-list">
                {TRAILBLAZER_BENEFITS.map(b => <li key={b}>{b}</li>)}
              </ul>
              <button type="button" className="profile-btn profile-btn-secondary" onClick={onManageSubscription}>
                Manage Subscription
              </button>
            </>
          ) : isVoyager ? (
            <>
              <div className="profile-plan-header">
                <TierBadge tier={TIERS.VOYAGER} />
                <span className="profile-plan-renewal">
                  {getTierPriceLabel(TIERS.VOYAGER)} · Renews {formatRenewalDate(profile?.premium_renewal_at)}
                </span>
              </div>
              {!hideTripUsage && monthlyUsageLabel && (
                <span className="profile-plan-usage">{monthlyUsageLabel}</span>
              )}
              <ul className="profile-benefits-list">
                {VOYAGER_BENEFITS.map(b => <li key={b}>{b}</li>)}
              </ul>
              <button type="button" className="profile-btn profile-btn-gold pricing-cta pricing-cta--gold" onClick={onUpgrade}>
                Upgrade to Trailblazer — {getTierPriceLabel(TIERS.TRAILBLAZER)}
              </button>
              <button type="button" className="profile-btn profile-btn-secondary" onClick={onManageSubscription}>
                Manage Subscription
              </button>
            </>
          ) : (
            <>
              <div className="profile-plan-header">
                <TierBadge tier={TIERS.WANDERER} />
                {!hideTripUsage && (
                  <span className="profile-plan-usage">{used} of {limit} Trip Generations used</span>
                )}
              </div>
              {!hideTripUsage && (
                <div className="profile-progress-wrap">
                  <div className="profile-progress-bar" style={{ width: `${progressPct}%` }} />
                </div>
              )}
              <PricingPlans
                billingInterval={billingPeriod}
                onBillingChange={setBillingPeriod}
                currentTier={TIERS.WANDERER}
                compact
                sections={{ showComparison: true, showFounder: true }}
                onUpgradeVoyager={onUpgradeVoyager}
                onUpgradeTrailblazer={onUpgrade}
              />
              <p className="profile-plan-pricing-link">
                <a href="/pricing">View full pricing page</a>
              </p>
            </>
          )}
        </section>

        <section className="profile-card">
          <h2 className="profile-section-title">Saved Trips</h2>
          {savedTrips.length > 0 ? (
            <div className="profile-trips-grid">
              {savedTrips.map(trip => (
                <SavedTripCard key={trip.id} trip={trip} onLoad={onLoadTrip} onDelete={onDeleteTrip} />
              ))}
            </div>
          ) : (
            <div className="profile-empty-state">
              <DecorMark className="profile-empty-icon" />
              <p className="profile-empty-title">Your journey starts here</p>
              <p className="profile-empty-sub">Save trips as you plan and they&apos;ll appear on your travel profile.</p>
              <button type="button" className="profile-btn profile-btn-gold" onClick={onPlanTrip}>
                Plan Your First Trip
              </button>
            </div>
          )}
        </section>

        <section className="profile-card profile-home-card">
          <h2 className="profile-section-title">Home Address</h2>
          <p className="profile-home-lead">Used by Navigate Home to route you back after a long drive.</p>
          {editingHome ? (
            <div className="profile-settings-field">
              {isLoaded ? (
                <Autocomplete options={{ types: ["geocode"] }}>
                  <input
                    ref={homeInputRef}
                    className="profile-input"
                    placeholder="123 Main St, Dallas, TX"
                    defaultValue={homeDraft}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveHome(); }}
                  />
                </Autocomplete>
              ) : (
                <input
                  ref={homeInputRef}
                  className="profile-input"
                  placeholder="123 Main St, Dallas, TX"
                  defaultValue={homeDraft}
                  onChange={e => setHomeDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveHome(); }}
                />
              )}
              <div className="profile-settings-actions">
                <button type="button" className="profile-btn profile-btn-gold" onClick={handleSaveHome} disabled={saving}>
                  Save
                </button>
                <button type="button" className="profile-btn profile-btn-ghost" onClick={() => setEditingHome(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : profile?.home_address ? (
            <div className="profile-home-display">
              <span className="profile-home-value">{profile.home_address}</span>
              <button type="button" className="profile-btn profile-btn-secondary" onClick={startEditHome}>Edit</button>
            </div>
          ) : (
            <div className="profile-empty-inline">
              <p>No home address saved yet.</p>
              <button type="button" className="profile-btn profile-btn-gold" onClick={startEditHome}>
                Add Home Address
              </button>
            </div>
          )}
        </section>

        <section className="profile-card">
          <h2 className="profile-section-title">Trip preferences</h2>
          <p className="profile-settings-hint">
            Save default vehicle, fuel, lodging, and other planner answers so new trips start pre-filled.
          </p>
          {onOpenPreferences && (
            <button type="button" className="profile-btn profile-btn-gold" onClick={onOpenPreferences}>
              Edit trip preferences
            </button>
          )}
        </section>

        <section id="profile-settings" className="profile-card profile-settings-card">
          <h2 className="profile-section-title">Profile Settings</h2>

          <div className="profile-settings-row">
            <div className="profile-settings-label">Display name</div>
            {editingName ? (
              <div className="profile-settings-field">
                <input
                  className="profile-input"
                  value={displayNameDraft}
                  onChange={e => setDisplayNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveName(); }}
                  aria-label="Display name"
                />
                <div className="profile-settings-actions">
                  <button type="button" className="profile-btn profile-btn-gold" onClick={handleSaveName} disabled={saving}>Save</button>
                  <button type="button" className="profile-btn profile-btn-ghost" onClick={() => setEditingName(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="profile-settings-value-row">
                <span>{displayName}</span>
                <button type="button" className="profile-link-btn" onClick={startEditName}>Edit</button>
              </div>
            )}
          </div>

          <div className="profile-settings-row">
            <div className="profile-settings-label">Emergency contact</div>
            {editingEmergency ? (
              <div className="profile-settings-field">
                <input
                  className="profile-input"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={emergencyDraft}
                  onChange={e => setEmergencyDraft(e.target.value)}
                />
                <p className="profile-settings-hint">Used for live sharing SOS alerts.</p>
                <div className="profile-settings-actions">
                  <button type="button" className="profile-btn profile-btn-gold" onClick={handleSaveEmergency} disabled={saving}>Save</button>
                  <button type="button" className="profile-btn profile-btn-ghost" onClick={() => setEditingEmergency(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="profile-settings-value-row">
                <span>{profile?.emergency_contact_phone || "Not set"}</span>
                <button type="button" className="profile-link-btn" onClick={startEditEmergency}>Edit</button>
              </div>
            )}
          </div>

          <div className="profile-settings-row">
            <div className="profile-settings-label">Email</div>
            {editingEmail ? (
              <div className="profile-settings-field">
                <input
                  className="profile-input"
                  type="email"
                  value={emailDraft}
                  onChange={e => setEmailDraft(e.target.value)}
                  aria-label="Email"
                />
                <div className="profile-settings-actions">
                  <button type="button" className="profile-btn profile-btn-gold" onClick={handleSaveEmail} disabled={saving}>Save</button>
                  <button type="button" className="profile-btn profile-btn-ghost" onClick={() => setEditingEmail(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="profile-settings-value-row">
                <span>{user?.email || "—"}</span>
                <button type="button" className="profile-link-btn" onClick={startEditEmail}>Change</button>
              </div>
            )}
          </div>

          <div className="profile-settings-row">
            <div className="profile-settings-label">Password</div>
            {editingPassword ? (
              <div className="profile-settings-field">
                <input
                  className="profile-input"
                  type="password"
                  placeholder="New password (min 8 characters)"
                  value={passwordDraft}
                  onChange={e => setPasswordDraft(e.target.value)}
                />
                <div className="profile-settings-actions">
                  <button type="button" className="profile-btn profile-btn-gold" onClick={handleSavePassword} disabled={saving}>Save</button>
                  <button type="button" className="profile-btn profile-btn-ghost" onClick={() => { setEditingPassword(false); setPasswordDraft(""); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="profile-settings-value-row">
                <span>••••••••</span>
                <button type="button" className="profile-link-btn" onClick={() => setEditingPassword(true)}>Change</button>
              </div>
            )}
          </div>

          <div className="profile-settings-row">
            <div className="profile-settings-label">Email notifications</div>
            <div className="profile-toggle-group">
              <label className="profile-toggle">
                <input
                  type="checkbox"
                  checked={notifyTripReminders}
                  onChange={e => handleNotifyChange(e.target.checked, notifyNewFeatures)}
                />
                <span>Trip reminders</span>
              </label>
              <label className="profile-toggle">
                <input
                  type="checkbox"
                  checked={notifyNewFeatures}
                  onChange={e => handleNotifyChange(notifyTripReminders, e.target.checked)}
                />
                <span>New features & updates</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            className="profile-btn profile-btn-signout"
            onClick={() => void onSignOut?.()}
          >
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
}
