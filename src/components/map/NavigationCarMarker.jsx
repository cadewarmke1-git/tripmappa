/**
 * NavigationCarMarker — animated gold CSS/SVG car rendered via OverlayView.
 * Replaces the static rotating-PNG approach with a smooth CSS-animated marker
 * that rotates to face its heading and bobs gently while driving.
 */
import { useEffect, useMemo, useRef } from "react";
import { OverlayView } from "@react-google-maps/api";
import { computePathHeadingDegrees } from "../../lib/navigationCarIcon.js";

/** Top-down gold vintage sedan SVG — points north (up) by default. */
function CarSVG() {
  return (
    <svg
      width="32"
      height="56"
      viewBox="0 0 32 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Drop shadow */}
      <ellipse cx="16" cy="50" rx="10" ry="3.5" fill="rgba(0,0,0,0.28)" />

      {/* Body */}
      <rect x="4" y="10" width="24" height="34" rx="4" fill="#C87010" />
      <rect x="5" y="12" width="22" height="30" rx="3" fill="#FFD28C" />

      {/* Roof / cabin */}
      <rect x="8" y="16" width="16" height="18" rx="3" fill="#B8680C" />

      {/* Windshield (front) */}
      <rect x="9" y="13" width="14" height="7" rx="2" fill="rgba(30,20,0,0.55)" />
      {/* Rear window */}
      <rect x="9" y="31" width="14" height="6" rx="2" fill="rgba(30,20,0,0.45)" />

      {/* Front wheels */}
      <rect x="1" y="11" width="6" height="9" rx="2.5" fill="#1A0D00" />
      <rect x="25" y="11" width="6" height="9" rx="2.5" fill="#1A0D00" />
      <rect x="2" y="12.5" width="4" height="6" rx="1.5" fill="#3A2A10" />
      <rect x="26" y="12.5" width="4" height="6" rx="1.5" fill="#3A2A10" />

      {/* Rear wheels */}
      <rect x="1" y="33" width="6" height="9" rx="2.5" fill="#1A0D00" />
      <rect x="25" y="33" width="6" height="9" rx="2.5" fill="#1A0D00" />
      <rect x="2" y="34.5" width="4" height="6" rx="1.5" fill="#3A2A10" />
      <rect x="26" y="34.5" width="4" height="6" rx="1.5" fill="#3A2A10" />

      {/* Headlights */}
      <rect x="8" y="10" width="5" height="3" rx="1" fill="#FFF8E0" opacity="0.9" />
      <rect x="19" y="10" width="5" height="3" rx="1" fill="#FFF8E0" opacity="0.9" />

      {/* Tail lights */}
      <rect x="8" y="43" width="5" height="3" rx="1" fill="#FF4444" opacity="0.85" />
      <rect x="19" y="43" width="5" height="3" rx="1" fill="#FF4444" opacity="0.85" />

      {/* Center stripe */}
      <rect x="15" y="14" width="2" height="26" rx="1" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

export default function NavigationCarMarker({ path = [], visible = false }) {
  const containerRef = useRef(null);
  const position = path?.[0];

  const heading = useMemo(
    () => (visible && path?.length >= 2 ? computePathHeadingDegrees(path) : 0),
    [visible, path],
  );

  // Apply rotation + smooth transition to the inner car element
  useEffect(() => {
    if (!containerRef.current) return;
    const car = containerRef.current.querySelector(".nav-car-inner");
    if (car) {
      car.style.transform = `rotate(${heading}deg)`;
    }
  }, [heading]);

  if (!visible || !position) return null;

  return (
    <OverlayView
      position={{ lat: position.lat, lng: position.lng }}
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
