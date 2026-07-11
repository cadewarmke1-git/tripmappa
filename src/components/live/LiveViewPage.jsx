import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GoldSpinner from "../GoldSpinner.jsx";
import { GoogleMap } from "@react-google-maps/api";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_LIBRARIES } from "../../lib/constants.js";
import { applyMapThemeStyles, resolveMapStyles } from "../../lib/mapStyles.js";
import AnimatedRoutePath from "../map/AnimatedRoutePath.jsx";
import LiveTravelerMarker from "./LiveTravelerMarker.jsx";
import BreadcrumbPath from "./BreadcrumbPath.jsx";
import ConvoyPin from "./ConvoyPin.jsx";
import ConvoyMemberList from "./ConvoyMemberList.jsx";
import SosButton, { SOS_UI_ENABLED } from "./SosButton.jsx";
import ArrivalCelebration, { TripCompletePanel } from "./ArrivalCelebration.jsx";

/** Twilio SMS follower alerts — hidden until integration is complete. */
const SMS_ALERTS_UI_ENABLED = false;
import UserAvatar from "../UserAvatar.jsx";
import {
  fetchLiveTripByToken,
  subscribeLiveTrip,
  joinLivePresence,
  mapLiveTripRow,
} from "../../lib/liveShareRealtime.js";
import {
  isLocationStale,
  formatLastSeen,
  getNextOvernightStop,
  getRoutePathFromLiveTrip,
  normalizeConvoyMembers,
  breadcrumbsToPath,
} from "../../lib/liveShareUtils.js";
import { joinConvoy, registerFollowerPhone, sendSosAlert } from "../../lib/liveShareApi.js";
import { useConvoyBroadcast } from "../../hooks/useConvoyBroadcast.js";
import { useTheme } from "../../context/ThemeContext.jsx";

const CONVOY_MEMBER_KEY = "tripmappa-convoy-member";

export default function LiveViewPage({ shareToken, toast }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: GOOGLE_LIBRARIES,
  });

  const [liveTrip, setLiveTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [showArrival, setShowArrival] = useState(false);
  const [convoyMember, setConvoyMember] = useState(() => {
    try {
      const raw = localStorage.getItem(`${CONVOY_MEMBER_KEY}-${shareToken}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [followerPhone, setFollowerPhone] = useState("");
  const [localToast, setLocalToast] = useState(null);
  const lastNotificationRef = useRef(null);
  const mapRef = useRef(null);
  const { theme } = useTheme();
  const mapStyles = useMemo(() => resolveMapStyles("standard", theme), [theme]);

  useEffect(() => {
    applyMapThemeStyles(mapRef.current, "standard", theme);
  }, [theme, isLoaded]);

  const notify = useCallback((msg, isGold = false) => {
    if (toast) toast(msg, isGold);
    else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 5000);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchLiveTripByToken(shareToken);
        if (cancelled) return;
        if (!row) {
          setError("This live trip link is inactive or expired.");
          setLoading(false);
          return;
        }
        const mapped = mapLiveTripRow(row);
        setLiveTrip(mapped);
        if (mapped.arrivedAt) setShowArrival(true);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load live trip");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [shareToken]);

  useEffect(() => {
    if (!shareToken || !liveTrip) return undefined;
    return subscribeLiveTrip(shareToken, row => {
      const mapped = mapLiveTripRow(row);
      setLiveTrip(mapped);
      if (row.last_notification?.at !== lastNotificationRef.current) {
        lastNotificationRef.current = row.last_notification?.at;
        if (row.last_notification?.message) {
          notify(row.last_notification.message, true);
        }
      }
      if (row.arrived_at) setShowArrival(true);
      if (row.is_active === false && !row.arrived_at) {
        setError("Live sharing has ended.");
      }
    });
  }, [shareToken, liveTrip?.id, notify]);

  useEffect(() => {
    if (!shareToken || !liveTrip?.isActive) return undefined;
    const viewerId = `viewer-${Math.random().toString(36).slice(2, 10)}`;
    return joinLivePresence(shareToken, {
      viewerId,
      viewerName: convoyMember?.name || null,
      onViewersChange: viewers => setViewerCount(viewers.length),
    });
  }, [shareToken, liveTrip?.isActive, convoyMember?.name]);

  useConvoyBroadcast({
    active: Boolean(convoyMember?.id && liveTrip?.isActive),
    shareToken,
    memberId: convoyMember?.id,
    onLocationUpdate: result => {
      if (result?.liveTrip) setLiveTrip(mapLiveTripRow(result.liveTrip));
    },
    onError: err => notify(err.message || "Convoy GPS error"),
  });

  const routePath = useMemo(() => getRoutePathFromLiveTrip(liveTrip), [liveTrip]);
  const breadcrumbPath = useMemo(() => breadcrumbsToPath(liveTrip?.breadcrumbs || []), [liveTrip?.breadcrumbs]);
  const convoyMembers = useMemo(() => normalizeConvoyMembers(liveTrip?.convoyMembers || []), [liveTrip?.convoyMembers]);
  const isLive = liveTrip && !isLocationStale(liveTrip.lastUpdated) && liveTrip.isActive;
  const lastSeenLabel = liveTrip ? formatLastSeen(liveTrip.lastUpdated) : "";
  const nextStop = liveTrip ? getNextOvernightStop(liveTrip.stops) : null;
  const tripComplete = liveTrip?.arrivedAt && !liveTrip?.isActive;

  const mapCenter = useMemo(() => {
    if (liveTrip?.latitude != null && liveTrip?.longitude != null) {
      return { lat: liveTrip.latitude, lng: liveTrip.longitude };
    }
    if (routePath.length) return routePath[Math.floor(routePath.length / 2)];
    return { lat: 39.8283, lng: -98.5795 };
  }, [liveTrip?.latitude, liveTrip?.longitude, routePath]);

  const userStub = { user_metadata: { full_name: liveTrip?.travelerDisplayName } };
  const profileStub = {
    display_name: liveTrip?.travelerDisplayName,
    avatar_url: liveTrip?.travelerAvatarUrl,
  };

  async function handleJoinConvoy() {
    if (!joinName.trim()) {
      notify("Enter your name to join the convoy");
      return;
    }
    setJoining(true);
    try {
      const result = await joinConvoy({
        shareToken,
        displayName: joinName.trim(),
        memberId: convoyMember?.id,
      });
      setConvoyMember(result.member);
      localStorage.setItem(`${CONVOY_MEMBER_KEY}-${shareToken}`, JSON.stringify(result.member));
      setLiveTrip(mapLiveTripRow(result.liveTrip));
      notify("You joined the convoy — sharing your location", true);
    } catch (err) {
      notify(err.message || "Could not join convoy");
    } finally {
      setJoining(false);
    }
  }

  async function handleRegisterPhone() {
    if (!followerPhone.trim()) {
      notify("Enter a phone number for alerts");
      return;
    }
    try {
      await registerFollowerPhone({ shareToken, phone: followerPhone });
      notify("SMS alerts coming soon — Twilio verification pending", true);
      setFollowerPhone("");
    } catch (err) {
      notify(err.message || "Could not register phone");
    }
  }

  async function handleSos() {
    try {
      const data = await sendSosAlert({
        shareToken,
        latitude: liveTrip?.latitude,
        longitude: liveTrip?.longitude,
      });
      if (data.placeholder) {
        notify("Emergency SMS coming soon — Twilio verification pending");
      } else {
        notify("Emergency alert sent", true);
      }
    } catch (err) {
      notify(err.message || "Could not send SOS");
    }
  }

  if (loading) {
    return (
      <div className={`app-wrap ${theme} live-view-page live-view-page-${theme}`}>
        <GoldSpinner size="lg" />
      </div>
    );
  }

  if (error && !liveTrip) {
    return (
      <div className={`app-wrap ${theme} live-view-page live-view-page-${theme}`}>
        <div className="live-view-error">
          <h1 className="live-view-error-title">Live trip unavailable</h1>
          <p>{error}</p>
          <a href="/" className="live-view-home-link">Go to TripMappa</a>
        </div>
      </div>
    );
  }

  const ownerRow = {
    name: liveTrip.travelerDisplayName,
    speedMph: liveTrip.ownerSpeedMph,
    distanceToDest: liveTrip.ownerDistanceToDest || liveTrip.etaDestination,
  };

  return (
    <div className={`app-wrap ${theme} live-view-page live-view-page-${theme}`}>
      {localToast && <div className="live-view-toast">{localToast}</div>}

      <ArrivalCelebration
        destination={liveTrip.destination}
        show={showArrival && !tripComplete}
        onDismiss={() => setShowArrival(false)}
      />

      {tripComplete ? (
        <div className="live-view-complete-wrap">
          <TripCompletePanel liveTrip={liveTrip} />
        </div>
      ) : isLoaded && (
        <GoogleMap
          mapContainerClassName="live-view-map"
          center={mapCenter}
          zoom={7}
          onLoad={map => {
            mapRef.current = map;
            applyMapThemeStyles(map, "standard", theme);
          }}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            styles: mapStyles,
          }}
        >
          <BreadcrumbPath breadcrumbs={breadcrumbPath} />
          {routePath.length > 1 && <AnimatedRoutePath path={routePath} />}
          {convoyMembers.map(m => (
            <ConvoyPin
              key={m.id}
              latitude={m.latitude}
              longitude={m.longitude}
              color={m.color}
              label={m.name?.split(" ")[0]}
            />
          ))}
          <LiveTravelerMarker
            latitude={liveTrip.latitude}
            longitude={liveTrip.longitude}
            isLive={isLive}
            lastSeenLabel={lastSeenLabel}
            avatarUrl={liveTrip.travelerAvatarUrl}
            displayName={liveTrip.travelerDisplayName}
          />
        </GoogleMap>
      )}

      {!tripComplete && (
        <div className="live-view-overlay">
          <div className="live-view-header">
            <UserAvatar user={userStub} profile={profileStub} size="md" showRing />
            <div>
              <div className="live-view-traveler-name">{liveTrip.travelerDisplayName}</div>
              <div className="live-view-route">{liveTrip.origin} → {liveTrip.destination}</div>
            </div>
            <div className={`live-view-status${isLive ? " live-view-status-live" : ""}`}>
              {isLive ? (
                <>
                  <span className="live-view-status-dot" aria-hidden="true" />
                  Live
                </>
              ) : (
                lastSeenLabel
              )}
            </div>
          </div>

          <div className="live-view-eta-card">
            <div className="live-view-eta-row">
              <span className="live-view-eta-label">ETA to destination</span>
              <span className="live-view-eta-value">{liveTrip.etaDestination || liveTrip.eta || "—"}</span>
            </div>
            {nextStop && (
              <div className="live-view-eta-row">
                <span className="live-view-eta-label">Next stop · {liveTrip.nextStopName || nextStop.city}</span>
                <span className="live-view-eta-value">{liveTrip.etaNextStop || "—"}</span>
              </div>
            )}
            {viewerCount > 0 && (
              <div className="live-view-viewers">{viewerCount} watching now</div>
            )}
          </div>

          {liveTrip.convoyMode && (
            <div className="live-view-convoy-card">
              <div className="share-title">Convoy</div>
              {!convoyMember ? (
                <div className="live-view-join-convoy">
                  <input
                    className="profile-input"
                    placeholder="Your name"
                    value={joinName}
                    onChange={e => setJoinName(e.target.value)}
                  />
                  <button type="button" className="profile-btn profile-btn-gold" onClick={handleJoinConvoy} disabled={joining}>
                    {joining ? "Joining…" : "Join Convoy"}
                  </button>
                </div>
              ) : (
                <p className="live-view-convoy-joined">Sharing as {convoyMember.name}</p>
              )}
              <ConvoyMemberList owner={ownerRow} convoyMembers={convoyMembers} compact />
            </div>
          )}

          {SMS_ALERTS_UI_ENABLED && (
            <div className="live-view-follower-phone">
              <div className="live-view-eta-label">Get SMS alerts at 30 min out</div>
              <div className="live-share-sms-row">
                <input
                  className="profile-input"
                  placeholder="(555) 123-4567"
                  value={followerPhone}
                  onChange={e => setFollowerPhone(e.target.value)}
                />
                <button type="button" className="profile-btn profile-btn-gold" onClick={handleRegisterPhone}>
                  Notify me
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!tripComplete && SOS_UI_ENABLED && <SosButton onConfirm={handleSos} className="live-sos-map" comingSoon />}
    </div>
  );
}
