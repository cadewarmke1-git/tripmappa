/** Fallback stop and safety data when /api/plan-trip fails — do not remove. */
export const RV_SAFETY_FALLBACK = {
  lowBridges: [
    { name: "Railroad overpass", clearance: "13'2\"", location: "Exit 45, TX" },
    { name: "Parkway tunnel", clearance: "13'6\"", location: "Downtown Amarillo" },
  ],
  steepGrades: [
    { location: "Capitan Mountains, NM", grade: "8.5%", note: "Steep grade — RVs reduce speed on grades over 8%." },
  ],
  sharpCurves: [
    { location: "US-64 switchbacks, NM", note: "Sharp switchbacks and tight mountain curves — not suitable for long RVs." },
  ],
  propaneLocations: [{ name: "AmeriGas", location: "Amarillo, TX" }, { name: "Ferrellgas", location: "Albuquerque, NM" }],
  dumpStations: [
    { name: "KOA dump station", location: "Amarillo, TX", distance: "At RV park" },
    { name: "Rest area dump", location: "I-40 West, NM", distance: "Mile marker 142" },
  ],
};

export const RV_STOPS_DATA = [
  {
    city: "Amarillo, TX", distance: "263 mi", eta: "3h 45m",
    rvPark: {
      name: "Amarillo KOA Journey",
      fullHookups: 42, amp30: true, amp50: true,
      pullThrough: 28, backIn: 14, maxLength: "45 ft",
      amenities: "WiFi · pool · laundry · dump station · dog park",
      rate: "$55/night",
    },
    campground: {
      name: "Palo Duro Canyon State Park",
      maxLength: "40 ft", hookups: "Water & electric",
      distanceFromHighway: "8 mi", reservation: "Reservation required",
    },
    freeParking: {
      name: "Walmart Supercenter #1847", type: "Walmart",
      note: "Free overnight parking — confirm with store before arrival",
      distance: "2 mi from route",
    },
    fuelStops: [
      { name: "Love's Travel Stop", location: "Vega, TX", distance: "95 mi", fuel: "Gasoline & diesel", highClearance: true, def: true, rvFriendly: true, amenities: "High clearance canopy · RV lanes · DEF" },
      { name: "Pilot Flying J", location: "Amarillo, TX", distance: "180 mi", fuel: "Gasoline", highClearance: true, def: false, rvFriendly: true, amenities: "High clearance · RV-friendly pumps" },
    ],
  },
  {
    city: "Albuquerque, NM", distance: "289 mi", eta: "4h 10m",
    rvPark: {
      name: "Good Sam Albuquerque North",
      fullHookups: 36, amp30: true, amp50: true,
      pullThrough: 20, backIn: 16, maxLength: "42 ft",
      amenities: "WiFi · pool · laundry · dump station",
      rate: "$62/night",
    },
    campground: {
      name: "Cibola National Forest Campground",
      maxLength: "35 ft", hookups: "No hookups",
      distanceFromHighway: "12 mi", reservation: "First come, first served",
    },
    freeParking: {
      name: "Cracker Barrel Old Country Store", type: "Cracker Barrel",
      note: "Free overnight parking — confirm with store before arrival",
      distance: "0.5 mi from route",
    },
    fuelStops: [
      { name: "TA/Petro", location: "Albuquerque, NM", distance: "140 mi", fuel: "Gasoline & diesel", highClearance: true, def: true, rvFriendly: true, amenities: "High clearance · DEF · repair" },
    ],
  },
];

export const TRUCK_STOPS_DATA = [
  {
    city: "Amarillo, TX", distance: "263 mi", eta: "3h 45m",
    truckStop: { name: "Pilot Travel Center #421", spaces: 142, showers: true, laundry: true, restaurant: true, diesel: "$3.89/gal", hours: "24/7" },
    motel: { name: "Roadrunner Inn", price: "$79/night", distance: "0.4 mi", parking: "Large rig parking confirmed" },
    restArea: { name: "I-40 East Rest Area", spaces: 28, distance: "12 mi", amenities: "Restrooms · vending · picnic" },
    fuelStops: [
      { name: "Pilot Flying J", location: "Amarillo, TX", distance: "180 mi", diesel: "$3.89/gal", amenities: "Showers · CAT scales · DEF · repair" },
      { name: "Love's Travel Stop", location: "Vega, TX", distance: "95 mi", diesel: "$3.92/gal", amenities: "Showers · scales · laundry" },
    ],
  },
  {
    city: "Albuquerque, NM", distance: "289 mi", eta: "4h 10m",
    truckStop: { name: "Love's Travel Stop #312", spaces: 98, showers: true, laundry: false, restaurant: true, diesel: "$3.91/gal", hours: "24/7" },
    motel: { name: "Budget Lodge", price: "$69/night", distance: "0.8 mi", parking: "Truck parking available" },
    restArea: { name: "NM Welcome Center", spaces: 16, distance: "8 mi", amenities: "Restrooms · info · picnic" },
    fuelStops: [
      { name: "TA/Petro", location: "Albuquerque, NM", distance: "140 mi", diesel: "$3.91/gal", amenities: "Showers · CAT scales · DEF" },
    ],
  },
];

export const TRUCK_SAFETY_FALLBACK = {
  weighStations: 3,
  lowBridges: [{ name: "Railroad underpass", clearance: "13'6\"", location: "Exit 98, OK" }],
  steepGrades: [{ location: "Raton Pass, NM", grade: "7.2%", note: "Steep grade ahead — reduce speed." }],
};

export const STOPS_DATA = [
  { city:"Amarillo, TX", distance:"263 mi", eta:"3h 45m",
    hotels:[{name:"Amarillo Grand Hotel",stars:4,price:"$129/night",pet:true},{name:"Big Texan Inn",stars:3,price:"$89/night",pet:false}],
    restaurants:[{name:"The Big Texan Steak Ranch",cuisine:"Steakhouse",rating:"4.6",time:"7:00 PM"},{name:"Crush Wine Bar",cuisine:"American",rating:"4.4",time:"8:00 PM"}] },
  { city:"Albuquerque, NM", distance:"289 mi", eta:"4h 10m",
    hotels:[{name:"Hotel Albuquerque",stars:4,price:"$149/night",pet:true},{name:"Nativo Lodge",stars:3,price:"$99/night",pet:false}],
    restaurants:[{name:"Sadie's of New Mexico",cuisine:"New Mexican",rating:"4.5",time:"7:00 PM"},{name:"Casa de Benavidez",cuisine:"Mexican",rating:"4.3",time:"8:00 PM"}] },
  { city:"Flagstaff, AZ", distance:"321 mi", eta:"4h 45m",
    hotels:[{name:"Little America Hotel",stars:4,price:"$159/night",pet:true},{name:"Drury Inn Flagstaff",stars:3,price:"$109/night",pet:false}],
    restaurants:[{name:"Tinderbox Kitchen",cuisine:"American",rating:"4.7",time:"7:00 PM"},{name:"Brix Restaurant",cuisine:"Fine Dining",rating:"4.6",time:"8:00 PM"}] },
];

export const ROAD_STOPS_FALLBACK = [
  { location: "Along route", distance: "—", eta: "—", category: "rest", name: "Rest area", note: "Scenic pull-off" },
];

export function normalizeRoadStop(s) {
  return {
    ...s,
    location: s.location || s.city || "Along route",
    distance: s.distance || "—",
    eta: s.eta || "—",
    category: ["fuel", "food", "rest", "charging"].includes(s.category) ? s.category : "rest",
    name: s.name || "Rest stop",
    note: s.note || "",
    fromLlm: s.fromLlm === true,
  };
}

export function mapHotelStops(apiStops) {
  return apiStops.map(stop => ({
    city: stop.city || stop.name || "Stop",
    distance: stop.distance || "—",
    eta: stop.eta || "—",
    why: stop.why || "",
    lat: stop.lat,
    lng: stop.lng,
    truckStop: stop.truckStop || stop.truck_stop,
    motel: stop.motel,
    restArea: stop.restArea || stop.rest_area,
    fuelStops: stop.fuelStops || stop.fuel_stops,
    rvPark: stop.rvPark || stop.rv_park,
    campground: stop.campground,
    freeParking: stop.freeParking || stop.free_parking,
    coordinationNote: stop.coordinationNote || stop.coordination_note,
    hotels: (stop.hotels || []).map(h => ({ name: h.name, stars: h.stars, price: h.price, pet: h.pet })),
    restaurants: (stop.restaurants || []).map(r => ({ name: r.name, cuisine: r.cuisine, rating: r.rating, time: r.time })),
  }));
}