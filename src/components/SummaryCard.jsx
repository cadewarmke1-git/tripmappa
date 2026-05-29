import {
  isTruckVehicle,
  isRvVehicle,
  isTruckerTrip,
  isRvTrip,
  isScenicRoute,
  inferFuelType,
  getEffectiveVehicle,
  formatPartySizeLabel,
  MULTI_VEHICLE_TRIP,
} from "../lib/vehicles.js";
import { isContinuousDrive } from "../lib/driveMode.js";

const PAYOFF_KEYS = ["Trip", "Vehicle", "Fuel", "Party size"];

export default function SummaryCard({ answers, hosCompliance, compactGrid = false, routeInfo = null }) {
  const effective = getEffectiveVehicle(answers);
  const fuel = inferFuelType(effective, answers.preferences || [], answers);
  const rows = [
    answers.trip_type && ["Trip", answers.trip_type],
    answers.vehicle && ["Vehicle", answers.vehicle],
    answers.vehicle === MULTI_VEHICLE_TRIP && answers.primary_vehicle && ["Primary vehicle", answers.primary_vehicle],
    Array.isArray(answers.multi_vehicles) && answers.multi_vehicles.length > 0 && ["Vehicles on trip", answers.multi_vehicles.join(", ")],
    answers.fuel_type && ["Fuel", answers.fuel_type],
    isTruckVehicle(effective) && answers.hauling_type && ["Hauling", answers.hauling_type],
    isTruckVehicle(effective) && answers.sleeper_cab && ["Sleeper cab", answers.sleeper_cab],
    isTruckVehicle(effective) && answers.truck_stop_brand && ["Truck stops", answers.truck_stop_brand],
    isTruckVehicle(effective) && answers.truck_height && ["Assumed specs", `${answers.truck_height} · ${answers.truck_weight} · Diesel · HOS required`],
    isRvVehicle(effective) && answers.rv_height && ["Assumed RV specs", `${answers.rv_height} · ${answers.rv_weight}`],
    formatPartySizeLabel(answers.travelers) && ["Party size", formatPartySizeLabel(answers.travelers)],
    isContinuousDrive(answers) && ["Drive mode", "Drive straight through"],
    answers.lodging && !isContinuousDrive(answers) && ["Lodging", answers.lodging],
    Array.isArray(answers.route_restrictions) && answers.route_restrictions.length > 0 && ["Route restrictions", answers.route_restrictions.join(", ")],
    Array.isArray(answers.coordination_needs) && answers.coordination_needs.length > 0 && ["Coordination", answers.coordination_needs.join(", ")],
    Array.isArray(answers.preferences) && answers.preferences.length > 0 && ["Preferences", answers.preferences.join(", ")],
    !answers.fuel_type && fuel && ["Fuel type", fuel],
  ].filter(Boolean);

  const payoffRows = rows.filter(([k]) => PAYOFF_KEYS.includes(k));
  const showPayoffGrid = compactGrid && payoffRows.length > 0;

  return (
    <div className={`summary-card${showPayoffGrid ? " summary-card-grid" : ""}`}>
      {showPayoffGrid ? (
        <div className="summary-grid">
          {payoffRows.map(([k, v]) => (
            <div className="summary-grid-item" key={k}>
              <div className="summary-key">{k}</div>
              <div className="summary-val">{v}</div>
            </div>
          ))}
        </div>
      ) : (
        rows.map(([k, v]) => (
          <div className="summary-row" key={k}>
            <div className="summary-key">{k}</div>
            <div>{v}</div>
          </div>
        ))
      )}
      {isContinuousDrive(answers) && (
        <div className="summary-kids-note">Drive straight through — no overnight lodging on this trip.</div>
      )}
      {!isContinuousDrive(answers) && answers.trip_type === "Day trip" && (
        <div className="summary-kids-note">Day trip — no overnight stops needed.</div>
      )}
      {isScenicRoute(answers) && (
        <div className="summary-kids-note">Scenic route selected — viewpoints noted at each stop</div>
      )}
      {isRvTrip(answers) && (
        <div className="summary-rv-note">
          RV Safe Route — bridges under 14ft flagged
        </div>
      )}
      {isTruckerTrip(answers) && hosCompliance && (
        <div className="summary-hos-note">
          HOS: {hosCompliance.drivingDays} driving day{hosCompliance.drivingDays > 1 ? "s" : ""}, {hosCompliance.overnightStopsRequired} overnight stop{hosCompliance.overnightStopsRequired !== 1 ? "s" : ""} required
        </div>
      )}
    </div>
  );
}
