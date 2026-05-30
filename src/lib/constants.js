import { GOLD_PRIMARY, ORANGE_PRIMARY, POLYLINE_COLOR, DEEP_DARK } from "./palette.js";

export { GOLD_PRIMARY, ORANGE_PRIMARY, POLYLINE_COLOR, DEEP_DARK };

export const GOOGLE_LIBRARIES = ["places", "routes", "geometry"];

export const STANDARD_MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export const HERO_PHOTOS_DAY = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80",
  "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1920&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80",
];

export const HERO_PHOTOS_NIGHT = [
  "https://images.unsplash.com/photo-1475070929565-c985b496cb9f?w=1920&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80",
  "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80",
  "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80",
];

export const DARK_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0a1628" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a0a0b0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1628" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2d45" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a4060" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050d2a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/** Warm desert road-atlas palette for day theme. */
export const DAY_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#E8D5A8" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3A1A08" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#E8D5A8" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#C8956A" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#3A1A08" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#3A1A08" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#A8B890" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3A1A08" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#C8956A" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#A87850" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#3A1A08" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#F0DEB8" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#C8956A" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#3A1A08" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#8AA8B8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3A1A08" }] },
];

/** Apple Maps–style dark theme applied when app theme is night. */
export const NIGHT_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: GOLD_PRIMARY }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: GOLD_PRIMARY }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: GOLD_PRIMARY }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: GOLD_PRIMARY }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: GOLD_PRIMARY }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: GOLD_PRIMARY }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
];

export const LEG_MAP_STYLES = {
  drive: { color: POLYLINE_COLOR, dashed: false, animate: true },
  fly: { color: "rgba(59,130,246,0.9)", dashed: true },
  ferry: { color: "rgba(20,184,166,0.9)", dashed: true },
  cruise: { color: "rgba(20,184,166,0.9)", dashed: true },
  train: { color: "rgba(168,85,247,0.9)", dashed: true },
  bus: { color: "rgba(168,85,247,0.9)", dashed: true },
};

export const TRIP_ROUTE_GOLD = POLYLINE_COLOR;

/** Per-day route colors for multi-day itinerary map */
export const DAY_ROUTE_COLORS = [
  TRIP_ROUTE_GOLD,
  TRIP_ROUTE_GOLD,
  TRIP_ROUTE_GOLD,
  TRIP_ROUTE_GOLD,
  TRIP_ROUTE_GOLD,
  TRIP_ROUTE_GOLD,
];
