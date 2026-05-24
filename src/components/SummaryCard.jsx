import {
  isTruckVehicle,
  isRvVehicle,
  isTruckerTrip,
  isRvTrip,
  hasFamilyKids,
  isScenicRoute,
  inferFuelType,
} from "../lib/vehicles.js";

export default function SummaryCard({ answers, hosCompliance }) {
  const fuel = inferFuelType(answers.vehicle, answers.preferences || []);
  const rows = [
    answers.trip_type && ["Trip", answers.trip_type],
    answers.vehicle && ["Vehicle", answers.vehicle],
    isTruckVehicle(answers.vehicle) && answers.hauling_type && ["Hauling", answers.hauling_type],
    isTruckVehicle(answers.vehicle) && answers.sleeper_cab && ["Sleeper cab", answers.sleeper_cab],
    isTruckVehicle(answers.vehicle) && answers.truck_stop_brand && ["Truck stops", answers.truck_stop_brand],
    isTruckVehicle(answers.vehicle) && answers.truck_height && ["Assumed specs", `${answers.truck_height} · ${answers.truck_weight} · Diesel`],
    isRvVehicle(answers.vehicle) && answers.rv_height && ["Assumed RV specs", `${answers.rv_height} · ${answers.rv_weight}`],
    answers.travelers && ["Travelers", answers.travelers],
    answers.lodging && ["Lodging", answers.lodging],
    Array.isArray(answers.route_restrictions) && answers.route_restrictions.length > 0 && ["Route restrictions", answers.route_restrictions.join(", ")],
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
