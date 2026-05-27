import { useEffect, useRef, useMemo } from "react";
import { Polyline } from "@react-google-maps/api";
import { TRIP_ROUTE_GOLD } from "../../lib/constants.js";

const DASH_ICON = {
  path: "M 0,-1 0,1",
  strokeOpacity: 1,
  strokeColor: TRIP_ROUTE_GOLD,
  scale: 4,
};

/** Gold route with flowing dash animation (Maps API icon offset). */
export default function AnimatedRoutePath({ path = [] }) {
  const dashPolylineRef = useRef(null);
  const animRef = useRef(null);

  const flowOpts = useMemo(() => ({
    strokeColor: TRIP_ROUTE_GOLD,
    strokeWeight: 5,
    strokeOpacity: 0,
    zIndex: 10,
    geodesic: true,
    icons: [{
      icon: DASH_ICON,
      offset: "0",
      repeat: "24px",
    }],
  }), []);

  useEffect(() => {
    if (!path.length) return;
    let offset = 0;
    animRef.current = window.setInterval(() => {
      offset = (offset + 2) % 48;
      const pl = dashPolylineRef.current;
      if (!pl) return;
      const icons = pl.get("icons");
      if (!icons?.length) return;
      pl.set("icons", icons.map((ic, i) => (i === 0 ? { ...ic, offset: `${offset}px` } : ic)));
    }, 50);
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [path]);

  if (path.length < 2) return null;

  return (
    <>
      <Polyline
        path={path}
        options={{
          strokeColor: TRIP_ROUTE_GOLD,
          strokeWeight: 5,
          strokeOpacity: 0.28,
          zIndex: 9,
          geodesic: true,
        }}
      />
      <Polyline
        path={path}
        options={flowOpts}
        onLoad={polyline => { dashPolylineRef.current = polyline; }}
        onUnmount={() => { dashPolylineRef.current = null; }}
      />
    </>
  );
}
