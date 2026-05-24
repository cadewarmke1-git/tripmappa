import {
  isTruckVehicle,
  isRvVehicle,
  isTruckerTrip,
  isRvTrip,
  hasFamilyKids,
  isScenicRoute,
  inferFuelType,
  getEffectiveVehicle,
  MULTI_VEHICLE_TRIP,
} from "../lib/vehicles.js";

export default function SummaryCard({ answers, hosCompliance }) {
  const effective = getEffectiveVehicle(answers);
  const fuel = inferFuelType(effective, answers.preferences || []);
  const rows = [
    answers.trip_type && ["Trip", answers.trip_type],
    answers.vehicle && ["Vehicle", answers.vehicle],
    answers.vehicle === MULTI_VEHICLE_TRIP && answers.primary_vehicle && ["Primary vehicle", answers.primary_vehicle],
    Array.isArray(answers.multi_vehicles) && answers.multi_vehicles.length > 0 && ["Vehicles on trip", answers.multi_vehicles.join(", ")],
    isTruckVehicle(effective) && answers.hauling_type && ["Hauling", answers.hauling_type],
    isTruckVehicle(effective) && answers.sleeper_cab && ["Sleeper cab", answers.sleeper_cab],
    isTruckVehicle(effective) && answers.truck_stop_brand && ["Truck stops", answers.truck_stop_brand],
    isTruckVehicle(effective) && answers.truck_height && ["Assumed specs", `${answers.truck_height} · ${answers.truck_weight} · Diesel · HOS required`],
    isRvVehicle(effective) && answers.rv_height && ["Assumed RV specs", `${answers.rv_height} · ${answers.rv_weight}`],
    answers.travelers && ["Travelers", answers.travelers],
    answers.kids_ages && ["Kids ages", answers.kids_ages],
    answers.lodging && ["Lodging", answers.lodging],
    Array.isArray(answers.route_restrictions) && answers.route_restrictions.length > 0 && ["Route restrictions", answers.route_restrictions.join(", ")],
    Array.isArray(answers.coordination_needs) && answers.coordination_needs.length > 0 && ["Coordination", answers.coordination_needs.join(", ")],
    Array.isArray(answers.preferences) && answers.preferences.length > 0 && ["Preferences", answers.preferences.join(", ")],
    fuel && ["Fuel type", fuel],
  ].filter(Boolean);

  return (
    <div className="summary-card">
      {rows.map(([k, v]) => (
        <div className="summary-row" key={k}>
          <div className="summary-key">{k}</div>
          <div>{v}</div>
        </div>
      ))}
      {hasFamilyKids(answers.travelers) && (
        <div className="summary-kids-note">
          Kid-friendly stops prioritized · Rest stops every 2 hours
        </div>
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
