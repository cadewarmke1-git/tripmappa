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
  return Array.from({ length: count }, (_, i) => {
    const r = 0.28 + rand() * 1.15;
    const tier = r > 0.95 ? "bright" : r > 0.55 ? "mid" : "dim";
    return {
      id: i,
      x: rand() * 100,
      y: rand() * 36,
      r,
      opacity: tier === "bright" ? 0.65 + rand() * 0.35 : 0.18 + rand() * 0.45,
      tier,
      twinkle: tier !== "dim" || rand() > 0.75,
    };
  });
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

/** Hour samples — animated sky + photo mountain grade. */
const SKY_ATMOSPHERE_KEYS = [
  { h: 0, zenith: [26, 16, 53], horizon: [42, 26, 74], warm: [255, 210, 140], warmth: 0, stars: 1, glow: 0, cloudSea: 0, photoBright: 0.38, photoContrast: 1.12, photoSat: 0.52, photoTint: [26, 16, 53], photoTintOp: 0.35 },
  { h: 4, zenith: [26, 16, 53], horizon: [42, 26, 74], warm: [255, 200, 130], warmth: 0.04, stars: 0.85, glow: 0, cloudSea: 0, photoBright: 0.48, photoContrast: 1.1, photoSat: 0.62, photoTint: [42, 26, 74], photoTintOp: 0.28 },
  { h: 5.5, zenith: [48, 58, 98], horizon: [145, 118, 138], warm: [255, 195, 145], warmth: 0.18, stars: 0.15, glow: 0.28, cloudSea: 0.22, photoBright: 0.82, photoContrast: 1.06, photoSat: 1.08, photoTint: [255, 170, 110], photoTintOp: 0.14 },
  { h: 7, zenith: [82, 128, 178], horizon: [196, 212, 232], warm: [255, 228, 200], warmth: 0.1, stars: 0, glow: 0.32, cloudSea: 0.08, photoBright: 1, photoContrast: 1.04, photoSat: 1.08, photoTint: [255, 220, 190], photoTintOp: 0.06 },
  { h: 12, zenith: [72, 132, 198], horizon: [218, 232, 245], warm: [255, 242, 225], warmth: 0.06, stars: 0, glow: 0.38, cloudSea: 0, photoBright: 1.02, photoContrast: 1.05, photoSat: 1.1, photoTint: [255, 248, 240], photoTintOp: 0 },
  { h: 16, zenith: [88, 118, 168], horizon: [225, 188, 148], warm: [255, 178, 95], warmth: 0.16, stars: 0, glow: 0.42, cloudSea: 0.05, photoBright: 0.98, photoContrast: 1.06, photoSat: 1.12, photoTint: [255, 200, 140], photoTintOp: 0.08 },
  { h: 18.5, zenith: [62, 48, 88], horizon: [195, 115, 72], warm: [255, 145, 70], warmth: 0.22, stars: 0.08, glow: 0.38, cloudSea: 0.12, photoBright: 0.88, photoContrast: 1.08, photoSat: 1.05, photoTint: [255, 140, 80], photoTintOp: 0.16 },
  { h: 20, zenith: [32, 26, 54], horizon: [82, 52, 68], warm: [255, 130, 80], warmth: 0.08, stars: 0.55, glow: 0.12, cloudSea: 0.2, photoBright: 0.55, photoContrast: 1.1, photoSat: 0.72, photoTint: [45, 32, 68], photoTintOp: 0.38 },
  { h: 22, zenith: [26, 16, 53], horizon: [42, 26, 74], warm: [255, 210, 140], warmth: 0, stars: 0.92, glow: 0, cloudSea: 0, photoBright: 0.4, photoContrast: 1.12, photoSat: 0.55, photoTint: [26, 16, 53], photoTintOp: 0.32 },
  { h: 24, zenith: [26, 16, 53], horizon: [42, 26, 74], warm: [255, 210, 140], warmth: 0, stars: 1, glow: 0, cloudSea: 0, photoBright: 0.38, photoContrast: 1.12, photoSat: 0.52, photoTint: [26, 16, 53], photoTintOp: 0.35 },
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
    cloudSea: lerp(a.cloudSea, b.cloudSea, t),
    photoBright: lerp(a.photoBright, b.photoBright, t),
    photoContrast: lerp(a.photoContrast, b.photoContrast, t),
    photoSat: lerp(a.photoSat, b.photoSat, t),
    photoTint: lerpRgb(a.photoTint, b.photoTint, t),
    photoTintOp: lerp(a.photoTintOp, b.photoTintOp, t),
  };
}

/** Continuous sky atmosphere — animated sky + graded photo mountains. */
export function getSkyAtmosphere(hour = 12) {
  const sample = sampleAtmosphere(hour);
  return {
    starOpacity: sample.stars,
    cssVars: {
      "--sky-zenith": rgbStr(sample.zenith),
      "--sky-horizon": rgbStr(sample.horizon),
      "--sky-warm": rgbStr(sample.warm),
      "--sky-warmth": String(sample.warmth),
      "--sky-stars": String(sample.stars),
      "--sky-glow": String(sample.glow),
      "--sky-clouds": "0",
      "--ridge-bleed": String(0.12 + sample.warmth * 0.55),
      "--milky-way": String(Math.max(0, sample.stars - 0.15) * 0.85),
      "--peak-haze": String(0.08 + sample.stars * 0.22),
      "--cloud-sea": String(sample.cloudSea),
      "--photo-bright": String(sample.photoBright),
      "--photo-contrast": String(sample.photoContrast),
      "--photo-sat": String(sample.photoSat),
      "--photo-tint": rgbStr(sample.photoTint),
      "--photo-tint-op": String(sample.photoTintOp),
    },
  };
}
