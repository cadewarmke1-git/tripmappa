import { OverlayView } from "@react-google-maps/api";
import UserAvatar from "../UserAvatar.jsx";

/** Gold pulsing live pin with optional avatar and stale badge. */
export default function LiveTravelerMarker({
  latitude,
  longitude,
  isLive,
  lastSeenLabel,
  avatarUrl,
  displayName,
}) {
  if (latitude == null || longitude == null) return null;

  const userStub = { user_metadata: {} };
  const profileStub = { avatar_url: avatarUrl, display_name: displayName };

  return (
    <OverlayView
      position={{ lat: latitude, lng: longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div className="live-traveler-marker-wrap">
        <div className={`live-traveler-pulse${isLive ? " live-traveler-pulse-active" : ""}`} aria-hidden="true" />
        <div className="live-traveler-pin">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="live-traveler-avatar-img" />
          ) : (
            <UserAvatar user={userStub} profile={profileStub} size={40} showRing />
          )}
        </div>
        {!isLive && lastSeenLabel && (
          <div className="live-traveler-stale-badge">{lastSeenLabel}</div>
        )}
      </div>
    </OverlayView>
  );
}
