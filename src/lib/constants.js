import {
  POLYLINE_COLOR,
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

export const GOOGLE_LIBRARIES = ["places", "routes", "geometry"];

export const STANDARD_MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

/** Self-hosted alpine hero photo — sky is animated separately via CSS mask. */
export const HERO_PHOTO = "/hero-mountain.jpg";

const MAP_LABEL_SIMPLIFY = [
  { elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

/** Warm muted road atlas — day theme (sand terrain, grey-brown roads, soft water). */
export const DAY_MAP_STYLES = [
  ...MAP_LABEL_SIMPLIFY,
  { elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: MAP_DAY_BASE }] },
  { elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL }] },
  { elementType: "labels.text.stroke", stylers: [{ color: MAP_DAY_BASE }, { weight: 2 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: MAP_DAY_ROAD_STROKE }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL_PRIMARY }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
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
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: MAP_DAY_WATER }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: MAP_DAY_LABEL }] },
];

/** Warm muted night atlas — charcoal sand land, grey-gold roads, subdued water. */
export const NIGHT_MAP_STYLES = [
  ...MAP_LABEL_SIMPLIFY,
  { elementType: "geometry", stylers: [{ color: MAP_NIGHT_BASE }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: MAP_NIGHT_BASE }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: MAP_NIGHT_BASE }] },
  { elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL }] },
  { elementType: "labels.text.stroke", stylers: [{ color: MAP_NIGHT_BASE }, { weight: 2 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: MAP_NIGHT_LOCAL_ROAD }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
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
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: MAP_NIGHT_HIGHWAY }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: MAP_NIGHT_HIGHWAY_STROKE }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: MAP_NIGHT_LABEL_ACCENT }] },
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
  train: { color: "rgba(255,140,66,0.9)", dashed: true },
  bus: { color: "rgba(255,140,66,0.9)", dashed: true },
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
