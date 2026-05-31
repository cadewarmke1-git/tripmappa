/** Local-time sky phases for the hero mountain scene and auto theme. */

export const SKY_CHECK_MS = 90_000;

export const SKY_PHASES = {
  pre_dawn: "pre_dawn",
  sunrise: "sunrise",
  midday: "midday",
  golden_hour: "golden_hour",
  dusk: "dusk",
  night: "night",
};

/** App theme default: day before 7 PM local, night at/after 7 PM. */
export function computeAutoTheme(now = new Date()) {
  return now.getHours() >= 19 ? "night" : "day";
}

/** Toggle target; clears manual override when it matches the time-based default. */
export function resolveThemeToggle(currentTheme, autoTheme) {
  const next = currentTheme === "day" ? "night" : "day";
  return next === autoTheme ? null : next;
}

/** Sky phase for hero: real time, or locked to theme when user overrides appearance. */
export function resolveSkyPhase({ theme = "night", now = new Date(), themeLocked = false } = {}) {
  if (themeLocked) return theme === "day" ? SKY_PHASES.midday : SKY_PHASES.night;
  return getSkyPhase(now);
}

export function getSkyPhaseFromHour(hour = 0) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 21) return SKY_PHASES.night;
  if (h >= 19) return SKY_PHASES.dusk;
  if (h >= 16) return SKY_PHASES.golden_hour;
  if (h >= 7) return SKY_PHASES.midday;
  if (h >= 5) return SKY_PHASES.sunrise;
  return SKY_PHASES.pre_dawn;
}

export function formatSkyHour(hour = 0) {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((((hour % 24) + 24) % 24 % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getSkyPhase(now = new Date()) {
  return getSkyPhaseFromHour(now.getHours() + now.getMinutes() / 60);
}

/** UI theme hint from sky phase (hero overlay / form colors). */
export function skyPhaseToUiTheme(phase) {
  if (phase === SKY_PHASES.night || phase === SKY_PHASES.pre_dawn) return "night";
  if (phase === SKY_PHASES.sunrise || phase === SKY_PHASES.golden_hour || phase === SKY_PHASES.dusk) {
    return "twilight";
  }
  return "day";
}

/** Smoother hero UI theme from fractional hour (avoids harsh day/night jumps). */
export function getHeroUiThemeFromHour(hour = 12) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 21 || h < 5) return "night";
  if (h >= 7 && h < 17) return "day";
  return "twilight";
}

/** Hero shell class: day = bright panels; twilight/night = frosted dark panels. */
export function getHeroSurfaceTheme(hour = 12) {
  return getHeroUiThemeFromHour(hour) === "day" ? "day" : "night";
}

/** Deterministic star field for night / pre-dawn skies. */
export function buildStarField(count = 48, seed = 42) {
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 38,
    r: 0.4 + rand() * 1.1,
    opacity: 0.2 + rand() * 0.45,
  }));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRgb(c1, c2, t) {
  return c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
}

function rgbStr([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Hour samples for smooth sky + mountain palette over the vector hero scene. */
const SKY_ATMOSPHERE_KEYS = [
  { h: 0, zenith: [12, 16, 38], horizon: [38, 34, 62], warm: [180, 190, 220], warmth: 0, stars: 1, glow: 0, mtnFar: [20, 24, 44], mtnMid: [12, 16, 32], mtnNear: [6, 8, 18], snow: [195, 205, 220], rim: 0.05, cloudSea: 0.28 },
  { h: 4, zenith: [18, 22, 52], horizon: [58, 48, 82], warm: [210, 170, 140], warmth: 0.04, stars: 0.85, glow: 0, mtnFar: [24, 28, 50], mtnMid: [16, 20, 38], mtnNear: [8, 10, 22], snow: [210, 215, 228], rim: 0.08, cloudSea: 0.32 },
  { h: 5.5, zenith: [48, 58, 98], horizon: [145, 118, 138], warm: [255, 195, 145], warmth: 0.18, stars: 0.15, glow: 0.28, mtnFar: [52, 58, 82], mtnMid: [38, 44, 68], mtnNear: [22, 28, 48], snow: [235, 228, 218], rim: 0.22, cloudSea: 0.55 },
  { h: 7, zenith: [82, 128, 178], horizon: [196, 212, 232], warm: [255, 228, 200], warmth: 0.1, stars: 0, glow: 0.32, mtnFar: [78, 98, 122], mtnMid: [52, 68, 88], mtnNear: [30, 40, 54], snow: [248, 250, 255], rim: 0.18, cloudSea: 0.82 },
  { h: 12, zenith: [72, 132, 198], horizon: [218, 232, 245], warm: [255, 242, 225], warmth: 0.06, stars: 0, glow: 0.38, mtnFar: [88, 108, 128], mtnMid: [58, 72, 92], mtnNear: [32, 42, 56], snow: [252, 254, 255], rim: 0.12, cloudSea: 0.94 },
  { h: 16, zenith: [88, 118, 168], horizon: [225, 188, 148], warm: [255, 178, 95], warmth: 0.16, stars: 0, glow: 0.42, mtnFar: [82, 98, 118], mtnMid: [54, 66, 86], mtnNear: [30, 38, 52], snow: [250, 242, 232], rim: 0.28, cloudSea: 0.88 },
  { h: 18.5, zenith: [62, 48, 88], horizon: [195, 115, 72], warm: [255, 145, 70], warmth: 0.22, stars: 0.08, glow: 0.38, mtnFar: [48, 42, 72], mtnMid: [32, 28, 52], mtnNear: [18, 16, 34], snow: [240, 210, 195], rim: 0.35, cloudSea: 0.62 },
  { h: 20, zenith: [32, 26, 54], horizon: [82, 52, 68], warm: [255, 130, 80], warmth: 0.08, stars: 0.55, glow: 0.12, mtnFar: [28, 24, 48], mtnMid: [18, 16, 36], mtnNear: [10, 10, 24], snow: [210, 200, 210], rim: 0.12, cloudSea: 0.4 },
  { h: 22, zenith: [14, 18, 40], horizon: [40, 36, 64], warm: [170, 175, 210], warmth: 0, stars: 0.92, glow: 0, mtnFar: [18, 22, 42], mtnMid: [10, 14, 30], mtnNear: [6, 8, 18], snow: [200, 208, 222], rim: 0.06, cloudSea: 0.3 },
  { h: 24, zenith: [12, 16, 38], horizon: [38, 34, 62], warm: [180, 190, 220], warmth: 0, stars: 1, glow: 0, mtnFar: [20, 24, 44], mtnMid: [12, 16, 32], mtnNear: [6, 8, 18], snow: [195, 205, 220], rim: 0.05, cloudSea: 0.28 },
];

function sampleAtmosphere(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_ATMOSPHERE_KEYS.length - 2 && SKY_ATMOSPHERE_KEYS[i + 1].h <= h) i += 1;
  const a = SKY_ATMOSPHERE_KEYS[i];
  const b = SKY_ATMOSPHERE_KEYS[i + 1];
  const span = b.h - a.h || 1;
  const t = Math.max(0, Math.min(1, (h - a.h) / span));
  return {
    zenith: lerpRgb(a.zenith, b.zenith, t),
    horizon: lerpRgb(a.horizon, b.horizon, t),
    warm: lerpRgb(a.warm, b.warm, t),
    warmth: lerp(a.warmth, b.warmth, t),
    stars: lerp(a.stars, b.stars, t),
    glow: lerp(a.glow, b.glow, t),
    mtnFar: lerpRgb(a.mtnFar, b.mtnFar, t),
    mtnMid: lerpRgb(a.mtnMid, b.mtnMid, t),
    mtnNear: lerpRgb(a.mtnNear, b.mtnNear, t),
    snow: lerpRgb(a.snow, b.snow, t),
    rim: lerp(a.rim, b.rim, t),
    cloudSea: lerp(a.cloudSea, b.cloudSea, t),
  };
}

function sunPosition(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5 || h >= 21) return null;
  const t = (h - 5) / 16;
  return {
    x: 10 + t * 80,
    y: 76 - Math.sin(t * Math.PI) * 44,
  };
}

function moonPosition(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 20) return null;
  const t = h >= 20 ? (h - 20) / 9 : (h + 4) / 9;
  const clamped = Math.max(0, Math.min(1, t));
  return {
    x: 14 + clamped * 72,
    y: 74 - Math.sin(clamped * Math.PI) * 40,
  };
}

/** Continuous sky atmosphere for the vector hero — sky, sun/moon, mountains, cloud sea. */
export function getSkyAtmosphere(hour = 12) {
  const sample = sampleAtmosphere(hour);
  const sun = sunPosition(hour);
  const moon = moonPosition(hour);
  const cloudOpacity = sample.stars > 0.45 ? 0.08 : 0.22 + sample.warmth * 0.45;
  return {
    starOpacity: sample.stars,
    cloudOpacity,
    cssVars: {
      "--sky-zenith": rgbStr(sample.zenith),
      "--sky-horizon": rgbStr(sample.horizon),
      "--sky-warm": rgbStr(sample.warm),
      "--sky-warmth": String(sample.warmth),
      "--sky-stars": String(sample.stars),
      "--sky-glow": String(sample.glow),
      "--sky-clouds": String(cloudOpacity),
      "--sun-x": sun ? `${sun.x}%` : "50%",
      "--sun-y": sun ? `${sun.y}%` : "50%",
      "--sun-visible": sun ? "1" : "0",
      "--moon-x": moon ? `${moon.x}%` : "50%",
      "--moon-y": moon ? `${moon.y}%` : "50%",
      "--moon-visible": moon ? "1" : "0",
      "--mtn-far": rgbStr(sample.mtnFar),
      "--mtn-mid": rgbStr(sample.mtnMid),
      "--mtn-near": rgbStr(sample.mtnNear),
      "--mtn-snow": rgbStr(sample.snow),
      "--mtn-rim": String(sample.rim),
      "--cloud-sea": String(sample.cloudSea),
    },
  };
}
