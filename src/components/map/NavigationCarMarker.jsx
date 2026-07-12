/**
 * NavigationCarMarker — animated gold CSS/SVG car rendered via OverlayView.
 * Replaces the static rotating-PNG approach with a smooth CSS-animated marker
 * that rotates to face its heading and bobs gently while driving.
 */
import { useEffect, useMemo, useRef } from "react";
import { OverlayView } from "@react-google-maps/api";
import { computePathHeadingDegrees } from "../../lib/navigationCarIcon.js";

/**
 * Top-down 1950s gold vintage sedan SVG — faces right (east) at 0°.
 * The outer wrapper rotates to match road heading; -90° is pre-applied
 * so that heading 0° (north/up on map) shows the car pointing north.
 */
function CarSVG() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 20"
      width="48"
      height="24"
      role="img"
      aria-label="Vintage car map marker"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="ncGoldBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0"    stopColor="#FFF3DC" />
          <stop offset="0.22" stopColor="#FFE1AF" />
          <stop offset="0.5"  stopColor="#FFD28C" />
          <stop offset="0.8"  stopColor="#E9AE63" />
          <stop offset="1"    stopColor="#C98A3E" />
        </linearGradient>
        <linearGradient id="ncGoldCabin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0"   stopColor="#FFF7E8" />
          <stop offset="0.5" stopColor="#FFDCA0" />
          <stop offset="1"   stopColor="#D89A4C" />
        </linearGradient>
        <radialGradient id="ncSheen" cx="0.36" cy="0.3" r="0.75">
          <stop offset="0"    stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="0.7"  stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Wheels */}
      <g fill="#0D0A1A">
        <rect x="8"  y="0.5"  width="6" height="3"   rx="1.3" />
        <rect x="8"  y="16.5" width="6" height="3"   rx="1.3" />
        <rect x="26" y="0.5"  width="6" height="3"   rx="1.3" />
        <rect x="26" y="16.5" width="6" height="3"   rx="1.3" />
      </g>

      {/* Car body */}
      <path
        d="M4.5 10 C4.5 5.4 7 2.6 12 2.4 C18 2.1 24 2.1 30 2.4 C34 2.6 35.5 5 35.5 10 C35.5 15 34 17.4 30 17.6 C24 17.9 18 17.9 12 17.6 C7 17.4 4.5 14.6 4.5 10 Z"
        fill="url(#ncGoldBody)" stroke="#0D0A1A" strokeWidth="1.4" strokeLinejoin="round" />

      {/* Reflective sheen */}
      <path
        d="M4.5 10 C4.5 5.4 7 2.6 12 2.4 C18 2.1 24 2.1 30 2.4 C34 2.6 35.5 5 35.5 10 C35.5 15 34 17.4 30 17.6 C24 17.9 18 17.9 12 17.6 C7 17.4 4.5 14.6 4.5 10 Z"
        fill="url(#ncSheen)" />

      {/* Specular highlight streak */}
      <path
        d="M7.5 6.4 C13 5.2 22 5 30 5.6 C31.5 5.9 31.6 7 30.2 7.2 C22 6.8 13.5 7 8.4 8 C6.8 8.3 6.2 6.7 7.5 6.4 Z"
        fill="#FFFFFF" opacity="0.5" />

      {/* Cabin / roof */}
      <path
        d="M14 10 C14 6.6 15.6 5.4 18.5 5.3 C21 5.2 23.5 5.2 25 5.6 C26.6 6 27 7.8 27 10 C27 12.2 26.6 14 25 14.4 C23.5 14.8 21 14.8 18.5 14.7 C15.6 14.6 14 13.4 14 10 Z"
        fill="url(#ncGoldCabin)" stroke="#0D0A1A" strokeWidth="1.2" strokeLinejoin="round" />

      {/* Cabin glare */}
      <path
        d="M15.6 6.6 C18.5 5.9 22.5 5.9 25 6.4 C25.8 6.6 25.6 7.4 24.8 7.3 C22 6.9 18.5 6.9 16 7.5 C15.1 7.7 14.8 6.8 15.6 6.6 Z"
        fill="#FFFFFF" opacity="0.55" />

      {/* Windshield / rear split */}
      <line x1="20.5" y1="5.4" x2="20.5" y2="14.6" stroke="#0D0A1A" strokeWidth="0.9" />

      {/* Hood accent */}
      <line x1="7" y1="10" x2="12.5" y2="10" stroke="#0D0A1A" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

export default function NavigationCarMarker({ path = [], position = null, heading: headingProp = null, visible = false }) {
  const containerRef = useRef(null);
  const routePosition = path?.[0];
  const activePosition = position || routePosition;

  const pathHeading = useMemo(
    () => (visible && path?.length >= 2 ? computePathHeadingDegrees(path) : 0),
    [visible, path],
  );

  const heading = headingProp != null && Number.isFinite(headingProp) ? headingProp : pathHeading;

  // Apply rotation + smooth transition to the inner car element.
  // The SVG art faces east (right), so we subtract 90° to make 0° = north.
  useEffect(() => {
    if (!containerRef.current) return;
    const car = containerRef.current.querySelector(".nav-car-inner");
    if (car) {
      car.style.transform = `rotate(${heading - 90}deg)`;
    }
  }, [heading]);

  if (!visible || !activePosition) return null;

  return (
    <OverlayView
      position={{ lat: activePosition.lat, lng: activePosition.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 999,
        }}
      >
        {/* Pulse ring */}
        <span
          style={{
            position: "absolute",
            inset: "-8px",
            borderRadius: "50%",
            background: "rgba(255, 210, 140, 0.18)",
            animation: "navCarPulse 1.8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        {/* Car — rotates to heading via JS, wrapped in a bob container */}
        <span
          className="nav-car-bob"
          style={{
            display: "block",
            animation: "navCarBob 1.2s ease-in-out infinite",
          }}
        >
          <span
            className="nav-car-inner"
            style={{
              display: "block",
              transformOrigin: "center center",
              transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))",
            }}
          >
            <CarSVG />
          </span>
        </span>
        <style>{`
          @keyframes navCarPulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.4); opacity: 0; }
          }
          @keyframes navCarBob {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-1.5px); }
          }
        `}</style>
      </div>
    </OverlayView>
  );
}
