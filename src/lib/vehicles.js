export const WATER_VEHICLES = ["Boat", "Ferry"];
export const TRUCK_VEHICLES = ["Semi Truck (18-wheeler)", "Box Truck", "Flatbed", "Tanker"];
export const RV_VEHICLES = ["RV", "Camper Van"];

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

export function needsVehicleSpecs(vehicle) {
  return isTruckVehicle(vehicle) || isRvVehicle(vehicle);
}

export function isRvTrip(answers) {
  return isRvVehicle(answers?.vehicle);
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
  return isTruckVehicle(answers?.vehicle) || isWorkDelivery(answers?.trip_type);
}

export function hasPref(answers, pref) {
  return Array.isArray(answers?.preferences) && answers.preferences.includes(pref);
}

export function inferFuelType(vehicle, preferences = []) {
  if (preferences.includes("EV charging stops")) return "Electric (EV)";
  if (isTruckVehicle(vehicle)) return "Diesel";
  return "Gasoline";
}

export function isScenicRoute(answers) {
  return hasPref(answers, "Scenic route");
}
