export const WATER_VEHICLES = ["Boat", "Ferry"];
export const TRUCK_VEHICLES = ["Semi Truck (18-wheeler)", "Box Truck", "Flatbed", "Tanker"];
export const RV_VEHICLES = ["RV", "Camper Van"];
export const MULTI_VEHICLE_TRIP = "Multi-Vehicle Trip";

export function getEffectiveVehicle(answers) {
  const vehicle = answers?.vehicle;
  if (vehicle === MULTI_VEHICLE_TRIP && answers?.primary_vehicle) {
    if (answers.primary_vehicle === "Truck") return "Semi Truck (18-wheeler)";
    return answers.primary_vehicle;
  }
  return vehicle || "Car";
}

export function isWaterVehicle(vehicle) {
  return WATER_VEHICLES.includes(vehicle);
}

export function isTruckVehicle(vehicle) {
  return TRUCK_VEHICLES.includes(vehicle);
}

export function isRvVehicle(vehicle) {
  return RV_VEHICLES.includes(vehicle);
}

export function getRouteTypeLabel(vehicleType) {
  if (isTruckVehicle(vehicleType)) return "Truck Route";
  if (isWaterVehicle(vehicleType)) return "Water Route";
  if (vehicleType === "Plane") return "Flight Route";
  if (vehicleType === "RV" || vehicleType === "Camper Van") return "RV Route";
  if (vehicleType === "Motorcycle") return "Moto Route";
  return "Car Route";
}

export function isOversizedVehicle(vehicle) {
  return ["Flatbed", "Tanker"].includes(vehicle);
}

export function needsVehicleSpecs() {
  return false;
}

export function applyAssumedVehicleSpecs(answers) {
  const out = { ...answers };
  if (isTruckVehicle(out.vehicle)) {
    const oversized = isOversizedVehicle(out.vehicle);
    out.truck_height = oversized ? "14'0\"" : "13'6\"";
    out.truck_weight = "80,000 lbs";
    out.truck_hazmat = "No";
    out.fuel = "Diesel";
  }
  if (isRvVehicle(out.vehicle)) {
    out.rv_height = "11'0\"";
    out.rv_weight = "12,000 lbs";
    out.rv_towing = "No";
  }
  return out;
}

export function isRvTrip(answers) {
  return isRvVehicle(getEffectiveVehicle(answers));
}

export function isWorkDelivery(tripType) {
  return tripType === "Work or Delivery run";
}

export function skipLodgingQuestion(tripType, vehicle) {
  if (tripType === "Day trip" || tripType === "Driving home") return true;
  if (tripType === "Flying" || tripType === "Ferry or Cruise") return true;
  if (vehicle === "Plane" || isWaterVehicle(vehicle)) return true;
  return false;
}

export function skipTravelersQuestion(tripType, vehicle) {
  if (isWorkDelivery(tripType)) return true;
  if (tripType === "Flying" || tripType === "Ferry or Cruise") return true;
  if (vehicle === "Plane") return true;
  return false;
}

export function skipPreferencesQuestion(tripType, vehicle) {
  if (tripType === "Flying" || vehicle === "Plane") return true;
  return false;
}

export function hasFamilyKids(travelers) {
  return travelers === "Family with kids";
}

export function isTruckerTrip(answers) {
  return isTruckVehicle(getEffectiveVehicle(answers)) || isWorkDelivery(answers?.trip_type);
}

export function hasPref(answers, pref) {
  return Array.isArray(answers?.preferences) && answers.preferences.includes(pref);
}

export function inferFuelType(vehicle, preferences = []) {
  if (preferences.includes("EV charging stops")) return "Electric (EV)";
  const effective = typeof vehicle === "object" ? getEffectiveVehicle(vehicle) : vehicle;
  if (isTruckVehicle(effective)) return "Diesel";
  return "Gasoline";
}

export function isScenicRoute(answers) {
  return hasPref(answers, "Scenic route");
}
