/** Imperial truck dimensions for HERE Routing API (metric output). */

const DEFAULT_HEIGHT_FEET = 13.5; // 13'6"
const DEFAULT_WEIGHT_LBS = 80000;
const DEFAULT_AXLE_COUNT = 5;

export function parseHeightFeet(value) {
  if (value == null || value === "") return DEFAULT_HEIGHT_FEET;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value).trim();
  const feetInches = str.match(/(\d+)['′]\s*(\d+)/);
  if (feetInches) {
    return parseInt(feetInches[1], 10) + parseInt(feetInches[2], 10) / 12;
  }
  const feetOnly = str.match(/([\d.]+)\s*(?:ft|feet|')\b/i);
  if (feetOnly) return parseFloat(feetOnly[1]);
  const meters = str.match(/([\d.]+)\s*m/i);
  if (meters) return parseFloat(meters[1]) / 0.3048;
  const n = parseFloat(str.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : DEFAULT_HEIGHT_FEET;
}

export function parseWeightLbs(value) {
  if (value == null || value === "") return DEFAULT_WEIGHT_LBS;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value).replace(/,/g, "").trim();
  const lbs = str.match(/([\d.]+)\s*(?:lbs?|pounds?)/i);
  if (lbs) return parseFloat(lbs[1]);
  const kg = str.match(/([\d.]+)\s*kg/i);
  if (kg) return parseFloat(kg[1]) * 2.20462;
  const n = parseFloat(str.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : DEFAULT_WEIGHT_LBS;
}

export function feetToMeters(feet) {
  return Math.round(feet * 0.3048 * 100) / 100;
}

export function feetToCentimeters(feet) {
  return Math.round(feet * 30.48);
}

export function poundsToKilograms(lbs) {
  return Math.round(lbs * 0.453592);
}

export function resolveTruckRequestSpecs(body = {}) {
  const heightFeet = body.heightFeet != null
    ? parseHeightFeet(body.heightFeet)
    : parseHeightFeet(body.height);
  const weightLbs = body.weightLbs != null
    ? parseWeightLbs(body.weightLbs)
    : parseWeightLbs(body.weight);
  const axleCount = Number.isFinite(Number(body.axleCount))
    ? Math.max(2, Math.min(9, Math.round(Number(body.axleCount))))
    : DEFAULT_AXLE_COUNT;
  const hazmat = body.hazmat === true
    || body.hazmat === "Yes"
    || body.hazmat === "yes"
    || body.hazmat === 1;

  return {
    heightFeet,
    weightLbs,
    heightMeters: feetToMeters(heightFeet),
    heightCm: feetToCentimeters(heightFeet),
    weightKg: poundsToKilograms(weightLbs),
    axleCount,
    hazmat,
  };
}
