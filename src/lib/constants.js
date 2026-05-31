import {
  GOLD_PRIMARY,
  ORANGE_PRIMARY,
  POLYLINE_COLOR,
  DEEP_DARK,
  MAP_NIGHT_BASE,
  MAP_NIGHT_LOCAL_ROAD,
  MAP_NIGHT_ARTERIAL,
  MAP_NIGHT_HIGHWAY,
  MAP_NIGHT_HIGHWAY_STROKE,
  MAP_NIGHT_LABEL,
  MAP_NIGHT_LABEL_ACCENT,
  MAP_NIGHT_WATER,
  MAP_NIGHT_PARK,
  MAP_DAY_BASE,
  MAP_DAY_LOCAL_ROAD,
  MAP_DAY_ARTERIAL,
  MAP_DAY_HIGHWAY,
  MAP_DAY_ROAD_STROKE,
  MAP_DAY_HIGHWAY_STROKE,
  MAP_DAY_LABEL,
  MAP_DAY_LABEL_PRIMARY,
  MAP_DAY_PARK,
  MAP_DAY_WATER,
} from "./palette.js";

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

/** Self-hosted alpine hero photo — sky is animated separately via CSS mask. */
export const HERO_PHOTO = "/hero-mountain.jpg";
export const HERO_PHOTO_PRELOAD = HERO_PHOTO;

/** @deprecated Use HERO_PHOTO — kept for legacy imports */
export const HERO_PHOTO_DAY = HERO_PHOTOS_DAY[0];
export const HERO_PHOTO_NIGHT = HERO_PHOTOS_NIGHT[0];


/** Warm amber desert terrain — day theme with clear land / road / water hierarchy. */
export const DAY_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL }] },
  { elementType: "labels.text.stroke", stylers: [{ color: MAP_DAY_BASE }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: MAP_DAY_ROAD_STROKE }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL_PRIMARY }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: MAP_DAY_PARK }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: MAP_DAY_LOCAL_ROAD }] },
  { featureType: "road.local", elementType: "geometry.stroke", stylers: [{ color: MAP_DAY_ROAD_STROKE }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: MAP_DAY_ARTERIAL }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: MAP_DAY_ROAD_STROKE }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: MAP_DAY_HIGHWAY }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: MAP_DAY_HIGHWAY_STROKE }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL_PRIMARY }] },
  { featureType: "road.highway", elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: MAP_DAY_WATER }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL }] },
];

/** Deep-space purple palette — night theme with gold highway accents. */
export const NIGHT_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: MAP_NIGHT_BASE }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: MAP_NIGHT_BASE }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: MAP_NIGHT_BASE }] },
  { elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL }] },
  { elementType: "labels.text.stroke", stylers: [{ color: MAP_NIGHT_BASE }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: MAP_NIGHT_LOCAL_ROAD }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL_ACCENT }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: MAP_NIGHT_PARK }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: MAP_NIGHT_LOCAL_ROAD }] },
  { featureType: "road.local", elementType: "geometry.stroke", stylers: [{ color: MAP_NIGHT_BASE }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: MAP_NIGHT_ARTERIAL }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: MAP_NIGHT_BASE }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL_ACCENT }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: MAP_NIGHT_HIGHWAY }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: MAP_NIGHT_HIGHWAY_STROKE }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL_ACCENT }] },
  { featureType: "road.highway", elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: MAP_NIGHT_WATER }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL }] },
];

/** Manual "Dark" map picker — same premium night palette as auto night theme. */
export const DARK_MAP_STYLES = NIGHT_MAP_STYLES;

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
