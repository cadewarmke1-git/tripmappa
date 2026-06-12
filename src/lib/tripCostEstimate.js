/** Transparent trip cost estimate from real fuel + lodging band inputs only. */
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { estimateOvernightStops } from "./budget.js";
import { getEffectiveVehicle } from "./vehicles.js";
import { lodgingTierToPriceBand } from "./placesFilters.js";
import { FUEL_PRICES, getVehicleMpg } from "./fuel.js";
import { isContinuousDrive } from "./driveMode.js";

const LODGING_BAND_MIDPOINT = {
  budget: 65,
  mid: 115,
  luxury: 220,
};

function resolveFuelPricePerGallon(answers, options = {}) {
  if (options.eiaFuelPrice != null) return options.eiaFuelPrice;
  const fuelType = answers?.fuel_type || answers?.fuel || "";
  if (/diesel/i.test(fuelType)) return FUEL_PRICES.diesel;
  if (/electric|ev/i.test(fuelType)) return null;
  return FUEL_PRICES.regular;
}

/**
 * @returns {{ total: number, fuel: number, lodging: number, label: string } | null}
 */
export function computeTransparentTripCostEstimate(answers, routeInfo, options = {}) {
  const miles = parseMilesFromDistance(routeInfo?.distance);
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const vehicle = getEffectiveVehicle(answers);
  const mpg = getVehicleMpg(vehicle);
  const fuelPrice = resolveFuelPricePerGallon(answers, options);

  const fuelType = answers?.fuel_type || answers?.fuel || "";
  const isEv = /electric|ev/i.test(fuelType);
  let fuel = null;
  if (miles != null && miles > 0) {
    if (isEv) {
      fuel = Math.round(miles * FUEL_PRICES.evPerMile);
    } else if (fuelPrice != null && mpg > 0) {
      fuel = Math.round((miles / mpg) * fuelPrice);
    }
  }

  const straightThrough = isContinuousDrive(answers);
  const nights = straightThrough
    ? 0
    : estimateOvernightStops(hours, answers?.trip_type, answers?.lodging);
  const band = lodgingTierToPriceBand(answers?.lodging);
  const lodgingMid = band ? LODGING_BAND_MIDPOINT[band] : null;
  let lodging = null;
  if (nights === 0) {
    lodging = 0;
  } else if (lodgingMid != null && nights > 0) {
    lodging = lodgingMid * nights;
  }

  if (fuel == null || lodging == null) return null;

  const fuelOnly = straightThrough || nights === 0;
  return {
    fuel,
    lodging,
    total: fuelOnly ? fuel : fuel + lodging,
    label: fuelOnly
      ? "Rough estimate — fuel from regional average × distance ÷ vehicle consumption"
      : "Rough estimate — fuel from regional average × distance, lodging from your selected band midpoint",
  };
}
