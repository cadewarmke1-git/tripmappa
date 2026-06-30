import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyToClipboard } from "../lib/copyToClipboard.js";
import UserAvatar from "./UserAvatar.jsx";
import ShareMiniMap from "./live/ShareMiniMap.jsx";
import ConvoyMemberList from "./live/ConvoyMemberList.jsx";
import SosButton from "./live/SosButton.jsx";
import ArrivalCelebration from "./live/ArrivalCelebration.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { createLiveShare, getLiveShareUrl, sendSosAlert } from "../lib/liveShareApi.js";
import {
  subscribeLiveTrip,
  joinLivePresence,
  stopLiveShare,
  mapLiveTripRow,
} from "../lib/liveShareRealtime.js";
import {
  getRoutePathFromLiveTrip,
  normalizeConvoyMembers,
  breadcrumbsToPath,
} from "../lib/liveShareUtils.js";
import { useLiveLocationBroadcast } from "../hooks/useLiveLocationBroadcast.js";
import LocationPermissionModal from "./LocationPermissionModal.jsx";

/** Twilio SMS sharing — hidden until integration is complete. */
const SMS_SHARING_UI_ENABLED = false;

const WARN_KEY = "tripmappa-live-share-warn";

export default function SharePanel({
  user,
  profile,
  session,
  hasTrip = false,
  origin,
  dest,
  stops = [],
  routeInfo,
  tripId = null,
  isLoaded,
  theme = "night",
  toast,
  onLiveSharingChange,
  onShareTrip: onShareSafetyTrip,
  onOpenCollaborate,
  hasCollaboration = false,
}) {
  const [shareUrl, setShareUrl] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [liveTrip, setLiveTrip] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [convoyMode, setConvoyMode] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [showSmsInput, setShowSmsInput] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [showArrival, setShowArrival] = useState(false);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [showWarning, setShowWarning] = useState(() => {
    try { return !sessionStorage.getItem(WARN_KEY); } catch { return true; }
  });
  const lastNotificationRef = useRef(null);

  const displayName = user ? getDisplayName(user, profile) : "You";
  const routePath = useMemo(() => {
    if (routeInfo?.routePoints?.length > 1) return routeInfo.routePoints;
    return getRoutePathFromLiveTrip(liveTrip);
  }, [routeInfo, liveTrip]);

  const convoyMembers = useMemo(
    () => normalizeConvoyMembers(liveTrip?.convoyMembers || []),
    [liveTrip?.convoyMembers],
  );

  const breadcrumbPath = useMemo(
    () => breadcrumbsToPath(liveTrip?.breadcrumbs || []),
    [liveTrip?.breadcrumbs],
  );

  const handleLocationUpdate = useCallback(result => {
    if (result?.liveTrip) setLiveTrip(mapLiveTripRow(result.liveTrip));
    if (result?.arrived) setShowArrival(true);
    if (result?.notification?.message) {
      toast?.(result.notification.message, true);
    }
  }, [toast]);

  const handleLocationError = useCallback(err => {
    toast?.(err.message || "Could not access GPS location");
  }, [toast]);

  useLiveLocationBroadcast({
    active: sharing && Boolean(shareToken) && !liveTrip?.arrivedAt,
    shareToken,
    stops,
    accessToken: session?.access_token,
    onLocationUpdate: handleLocationUpdate,
    onError: handleLocationError,
  });

  useEffect(() => {
    onLiveSharingChange?.(sharing && !liveTrip?.arrivedAt);
  }, [sharing, liveTrip?.arrivedAt, onLiveSharingChange]);

  useEffect(() => {
    if (!shareToken || !sharing) return undefined;
    return subscribeLiveTrip(shareToken, row => {
      const mapped = mapLiveTripRow(row);
      setLiveTrip(mapped);
      if (row.last_notification?.at !== lastNotificationRef.current) {
        lastNotificationRef.current = row.last_notification?.at;
        if (row.last_notification?.message) {
          toast?.(row.last_notification.message, true);
        }
      }
      if (row.arrived_at && !showArrival) setShowArrival(true);
      if (row.is_active === false) {
        setSharing(false);
      }
    });
  }, [shareToken, sharing, toast, showArrival]);

  useEffect(() => {
    if (!shareToken || !sharing) return undefined;
    const ownerId = user?.id || "owner";
    return joinLivePresence(shareToken, {
      viewerId: `owner-${ownerId}`,
      viewerName: displayName,
      onViewersChange: list => {
        setViewers(list.filter(v => !String(v.id).startsWith("owner-")));
      },
    });
  }, [shareToken, sharing, user?.id, displayName]);

  function requestDeviceLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported in this browser"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    });
  }

  async function startLiveShareWithLocation() {
    setStarting(true);
    try {
      let lat = null;
      let lng = null;
      try {
        const coords = await requestDeviceLocation();
        lat = coords.lat;
        lng = coords.lng;
      } catch {
        setLocationDenied(true);
        setLocationPromptOpen(true);
        return;
      }

      const result = await createLiveShare(session.access_token, {
        tripId,
        origin,
        destination: dest,
        stops,
        eta: routeInfo?.duration,
        routeInfo,
        latitude: lat,
        longitude: lng,
        travelerDisplayName: displayName,
        travelerAvatarUrl: profile?.avatar_url || null,
        existingShareToken: shareToken || null,
        convoyMode,
      });

      setShareUrl(result.shareUrl || getLiveShareUrl(result.shareToken));
      setShareToken(result.shareToken);
      setLiveTrip(mapLiveTripRow(result.liveTrip));
      setSharing(true);
      toast?.("Live sharing started", true);
    } catch (err) {
      toast?.(err.message || "Could not start live sharing");
    } finally {
      setStarting(false);
    }
  }

  async function handleShareMyTrip() {
    if (!user || !session?.access_token) {
      toast?.("Sign in to share your live location");
      return;
    }
    if (!hasTrip || !origin?.trim() || !dest?.trim()) {
      toast?.("Plan a trip first to share live location");
      return;
    }
    if (!navigator.geolocation) {
      toast?.("Location is not available in this browser", { isError: true });
      return;
    }
    setLocationDenied(false);
    setLocationPromptOpen(true);
  }

  async function handleAllowLocation() {
    setLocationPromptOpen(false);
    await startLiveShareWithLocation();
  }

  function handleDenyLocation() {
    setLocationPromptOpen(false);
    if (locationDenied) {
      toast?.("Live sharing needs location access. Enable it in browser settings to continue.", { isError: true });
    }
  }

  async function handleStopSharing() {
    if (!shareToken || !user?.id) return;
    try {
      await stopLiveShare(shareToken, user.id);
      setSharing(false);
      setShareUrl("");
      setShareToken("");
      setLiveTrip(null);
      setViewers([]);
      setShowArrival(false);
      toast?.("Live sharing stopped");
    } catch (err) {
      toast?.(err.message || "Could not stop sharing");
    }
  }

  async function handleSos() {
    if (!shareToken) return;
    try {
      const data = await sendSosAlert({
        shareToken,
        latitude: liveTrip?.latitude,
        longitude: liveTrip?.longitude,
        accessToken: session?.access_token,
      });
      if (data.placeholder) {
        toast?.("Emergency SMS coming soon — Twilio verification pending");
      } else {
        toast?.("Emergency alert sent to your contact", true);
      }
    } catch (err) {
      toast?.(err.message || "Could not send SOS");
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    const { ok } = await copyToClipboard(shareUrl);
    if (ok) toast?.("Live link copied", true);
    else toast?.("Could not copy — select and copy the link manually.", { isError: true, duration: 8000 });
  }

  function handleSendSms() {
    if (!smsPhone.trim()) {
      toast?.("Enter a phone number");
      return;
    }
    toast?.("SMS sharing coming soon");
    setShowSmsInput(false);
    setSmsPhone("");
  }

  function dismissWarning() {
    setShowWarning(false);
    try { sessionStorage.setItem(WARN_KEY, "1"); } catch { /* ignore */ }
  }

  const ownerConvoyRow = {
    name: displayName,
    speedMph: liveTrip?.ownerSpeedMph,
    distanceToDest: liveTrip?.ownerDistanceToDest || liveTrip?.etaDestination,
  };

  return (
    <div className="share-wrap share-wrap-live">
      <div className="share-mode-explainer">
        <div className="share-mode-card">
          <div className="share-mode-title">Live GPS sharing</div>
          <p className="share-mode-desc">Friends follow your real-time location on the map while you drive.</p>
        </div>
        <div className="share-mode-card share-mode-card-muted">
          <div className="share-mode-title">Share your itinerary</div>
          <p className="share-mode-desc">A polished, read-only trip anyone can open — family, friends, or social. Works on any device.</p>
        </div>
        <div className="share-mode-card share-mode-card-collab">
          <div className="share-mode-title">Group collaboration</div>
          <p className="share-mode-desc">Invite others to vote on stops, suggest alternatives, and share dietary or travel preferences.</p>
          {onOpenCollaborate && (
            <button
              type="button"
              className="share-collab-btn"
              onClick={onOpenCollaborate}
              disabled={!hasTrip || !user}
            >
              {hasCollaboration ? "Open collaboration" : "Start collaborating"}
            </button>
          )}
        </div>
      </div>

      {showWarning && sharing && (
        <div className="live-share-warning">
          <p>Live sharing uses GPS and data. Your battery may drain faster.</p>
          <button type="button" className="live-share-warning-dismiss" onClick={dismissWarning}>Dismiss</button>
        </div>
      )}

      <ArrivalCelebration
        destination={dest}
        show={showArrival}
        onDismiss={() => setShowArrival(false)}
      />

      {!sharing && (
        <label className="convoy-mode-toggle">
          <input
            type="checkbox"
            checked={convoyMode}
            onChange={e => setConvoyMode(e.target.checked)}
          />
          <span>Convoy Mode — let others share their location too</span>
        </label>
      )}

      {sharing && liveTrip?.convoyMode && (
        <div className="convoy-mode-active-badge">Convoy Mode active</div>
      )}

      <button
        type="button"
        className="btn-generate live-share-main-btn"
        onClick={sharing ? handleCopyLink : handleShareMyTrip}
        disabled={starting || (!sharing && !hasTrip)}
      >
        {starting ? "Starting live share…" : sharing ? "Copy Live Link" : "Share My Trip"}
      </button>

      {!user && (
        <p className="share-sub share-auth-hint">Sign in to share your live location with friends and family.</p>
      )}

      {sharing && shareUrl && (
        <div className="live-share-url-block">
          <div className="live-share-url-label">Live link</div>
          <div className="live-share-url-row">
            <input className="live-share-url-input" readOnly value={shareUrl} onFocus={e => e.target.select()} />
            <button type="button" className="profile-btn profile-btn-gold" onClick={handleCopyLink}>Copy Link</button>
          </div>
          {SMS_SHARING_UI_ENABLED && showSmsInput && (
            <div className="live-share-sms-row">
              <input
                className="profile-input"
                placeholder="(555) 123-4567"
                value={smsPhone}
                onChange={e => setSmsPhone(e.target.value)}
              />
              <button type="button" className="profile-btn profile-btn-gold" onClick={handleSendSms}>Send</button>
            </div>
          )}
        </div>
      )}

      {sharing && (
        <ShareMiniMap
          isLoaded={isLoaded}
          latitude={liveTrip?.latitude}
          longitude={liveTrip?.longitude}
          routePath={routePath}
          breadcrumbPath={breadcrumbPath}
          convoyMembers={convoyMembers}
          ownerName={displayName}
          followerCount={viewers.length}
          theme={theme}
        />
      )}

      {sharing && liveTrip && (
        <div className="live-share-eta-strip">
          <span>ETA to destination</span>
          <strong>{liveTrip.etaDestination || liveTrip.eta || "Calculating…"}</strong>
        </div>
      )}

      {sharing && (
        <>
          <div className="share-title">Convoy</div>
          <ConvoyMemberList owner={ownerConvoyRow} convoyMembers={convoyMembers} />
        </>
      )}

      <div className="share-title">Live viewers</div>
      <div className="share-sub">
        {sharing
          ? "People watching your live link appear here in real time."
          : "Start sharing to let friends and family follow your trip live."}
      </div>

      {user && (
        <div className="person-row person-row-you">
          <UserAvatar user={user} profile={profile} size="sm" />
          <div style={{ flex: 1 }}>
            <div className="person-name">{displayName} (you)</div>
            <div className="person-status">
              <span className={`dot ${sharing ? "dot-live" : "dot-pending"}`} />
              {sharing ? "Broadcasting live" : "Not sharing"}
            </div>
          </div>
        </div>
      )}

      {viewers.length > 0 ? viewers.map((v, i) => (
        <div className="person-row" key={v.id || i}>
          <div className="avatar">{v.name?.charAt(0)?.toUpperCase() || "?"}</div>
          <div style={{ flex: 1 }}>
            <div className="person-name">{v.name || "Anonymous Viewer"}</div>
            <div className="person-status">
              <span className="dot dot-live dot-live-pulse" />
              Watching live
            </div>
          </div>
        </div>
      )) : sharing ? (
        <div className="live-share-no-viewers">No one is watching yet — send them the link!</div>
      ) : null}

      {sharing && (
        <button type="button" className="live-share-stop-btn" onClick={handleStopSharing}>
          Stop Sharing
        </button>
      )}

      {sharing && <SosButton onConfirm={handleSos} className="live-sos-share-panel" comingSoon />}

      {hasTrip && onShareSafetyTrip && (
        <div className="share-safety-block">
          <div className="share-safety-title">Share your itinerary</div>
          <div className="share-safety-sub">
            Copy a link to your full trip — verified stops, route, and overnights. No live GPS.
          </div>
          <button type="button" className="action-btn share-safety-btn" onClick={onShareSafetyTrip}>
            Copy trip link
          </button>
        </div>
      )}
      <LocationPermissionModal
        open={locationPromptOpen}
        denied={locationDenied}
        onAllow={handleAllowLocation}
        onDeny={handleDenyLocation}
      />
    </div>
  );
}
