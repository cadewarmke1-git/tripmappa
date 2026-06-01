/** Active trip-generation endpoint (Anthropic Sonnet). Called via src/lib/apiClient.js only. */
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { fetchCreditStatus, consumeCredit } from "../lib/tripCredits.js";

function parseJsonFromLlm(text) {
  if (!text) throw new Error("Empty model response");
  const clean = String(text).replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("Could not parse trip JSON from model");
  }
}

function tripResponseHasContent(parsed) {
  const stops = Array.isArray(parsed?.stops)
    ? parsed.stops.filter(s => s && (s.city || s.name))
    : [];
  const roadStops = Array.isArray(parsed?.road_stops)
    ? parsed.road_stops.filter(s => s && (s.name || s.city))
    : [];
  return stops.length > 0 || roadStops.length > 0;
}

async function callAnthropic(model, systemPrompt, userPrompt, maxTokens) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json();
  return { response, data };
}

const TRUCK_TYPES = ["Semi Truck (18-wheeler)", "Box Truck", "Flatbed", "Tanker"];
const RV_TYPES = ["RV", "Camper Van"];
const WATER_TYPES = ["Boat", "Ferry"];
function resolveEffectiveVehicle(a) {
  const v = a?.vehicle || "Car";
  if (v === "Multi-Vehicle Trip" && a?.primary_vehicle) {
    if (a.primary_vehicle === "Truck") return "Semi Truck (18-wheeler)";
    return a.primary_vehicle;
  }
  return a?.effective_vehicle || v;
}

function parseRouteMiles(dist) {
  if (!dist || dist === "unknown") return 0;
  const m = String(dist).match(/([\d,.]+)\s*mi/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}

function formatLeaveTime(departureTime, timingMode) {
  if (timingMode === "leave_now") {
    const d = departureTime ? new Date(departureTime) : new Date();
    if (Number.isNaN(d.getTime())) return "Leave now (current departure time)";
    return `Leave now — departure ${d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  }
  if (departureTime) {
    const d = new Date(departureTime);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
  }
  return timingMode || "Not specified";
}

function buildTravelerProfile(answers) {
  const t = answers?.travelers;
  const youngKids = Array.isArray(answers?.accessibility) && answers.accessibility.includes("Traveling with young children");
  const elderly = Array.isArray(answers?.accessibility) && answers.accessibility.includes("Traveling with elderly passengers");
  if (youngKids) return "Family with young children";
  if (t === "1") return "Solo traveler";
  if (t === "2" && !youngKids) return "Couple";
  if (t === "3 to 5" || t === "6 or more") return youngKids ? "Family group" : "Group travelers";
  if (elderly) return "Travelers including elderly passengers";
  return t ? `${t} travelers` : "Not specified";
}

function classifyTrip(answers, vehicle, rawVehicle) {
  if (rawVehicle === "Multi-Vehicle Trip") return "multi";
  if (vehicle === "Plane" || rawVehicle === "Plane" || answers?.trip_type === "Flying") return "plane";
  if (WATER_TYPES.includes(vehicle) || WATER_TYPES.includes(rawVehicle) || answers?.trip_type === "Ferry or Cruise") return "water";
  if (TRUCK_TYPES.includes(vehicle) || answers?.trip_type === "Work or Delivery run") return "commercial";
  if (RV_TYPES.includes(vehicle)) return "rv";
  return "personal";
}

function buildTripContext(reqBody) {
  const { origin, destination, answers = {}, routeInfo = {}, legs, departureTime, timingMode } = reqBody;
  const rawVehicle = answers.vehicle || "Car";
  const vehicle = resolveEffectiveVehicle(answers);
  const preferences = Array.isArray(answers.preferences) ? answers.preferences : [];
  const routeRestrictions = Array.isArray(answers.route_restrictions) ? answers.route_restrictions : [];
  const coordinationNeeds = Array.isArray(answers.coordination_needs) ? answers.coordination_needs : [];
  const dietary = Array.isArray(answers.dietary) ? answers.dietary : [];
  const accessibility = Array.isArray(answers.accessibility) ? answers.accessibility : [];
  const stopsInterests = Array.isArray(answers.stops_interests) ? answers.stops_interests : [];
  const routeOrigin = routeInfo.origin || origin;
  const routeDestination = routeInfo.destination || destination;
  const routeDistance = routeInfo.distance || "unknown";
  const routeDuration = routeInfo.duration || "unknown";
  const citiesAlongRoute = Array.isArray(routeInfo.citiesAlongRoute) ? routeInfo.citiesAlongRoute : [];
  const legCities = Array.isArray(legs)
    ? legs.map(leg => leg.end || leg.to || leg.destination || leg.city).filter(Boolean)
    : [];
  const fuel =
    answers.fuel ||
    answers.fuel_type ||
    (preferences.includes("EV charging stops") ? "Electric (EV)" : TRUCK_TYPES.includes(vehicle) ? "Diesel" : "Gasoline");
  const youngKids = accessibility.includes("Traveling with young children");
  const tripCategory = classifyTrip(answers, vehicle, rawVehicle);

  return {
    origin,
    destination,
    routeOrigin,
    routeDestination,
    routeDistance,
    routeDuration,
    routeMiles: parseRouteMiles(routeDistance),
    citiesAlongRoute,
    legCities,
    tripType: answers.trip_type || "Road trip",
    rawVehicle,
    vehicle,
    fuel,
    travelerType: buildTravelerProfile(answers),
    youngKids,
    lodging: answers.lodging || "Mid-Range",
    preferences,
    routeRestrictions,
    coordinationNeeds,
    haulingType: answers.hauling_type || "General freight",
    sleeperCab: answers.sleeper_cab || "Unknown",
    truckStopBrand: answers.truck_stop_brand || answers.truck_stop_preference || "No preference",
    truckHeight: answers.truck_height || "13'6\"",
    truckWeight: answers.truck_weight || "80,000 lbs",
    truckHazmat: answers.truck_hazmat || "No",
    rvHeight: answers.rv_height || "11'0\"",
    rvWeight: answers.rv_weight || "12,000 lbs",
    rvTowing: answers.rv_towing || "No",
    multiVehicles: answers.multi_vehicles || [],
    primaryVehicle: answers.primary_vehicle,
    dietary,
    accessibility,
    stopsInterests,
    tripBudget: answers.trip_budget,
    towing: answers.towing,
    loyalty: answers.loyalty_program,
    foodAllergies: answers.food_allergies,
    scheduleRestrictions: Array.isArray(answers.schedule_restrictions) ? answers.schedule_restrictions : [],
    scheduleDriveHours: answers.schedule_drive_hours,
    continuousDrive:
      answers.continuous_drive === true
      || answers.overnight_preference === "Drive straight through"
      || answers.lodging === "No overnight stay",
    leaveTime: formatLeaveTime(departureTime, timingMode),
    isScenic: preferences.includes("Scenic route") || routeInfo.scenic === true,
    tripCategory,
    partySize: (() => {
      const t = answers.travelers;
      if (t === "1") return 1;
      if (t === "2") return 2;
      if (t === "3 to 5") return 4;
      if (t === "6 or more") return 6;
      return null;
    })(),
  };
}

const SYSTEM_PROMPT = `You are TripMappa's expert AI trip planner. You have deep knowledge of US highways, road conditions, vehicle-specific routing requirements, HOS regulations for commercial drivers, RV travel, motorcycle travel, family road trips, and general travel planning.

You never give generic suggestions. Every single recommendation must be specific to the exact route, vehicle type, traveler type, and distance provided in the user message.

You always recommend real places that actually exist along the route corridor. You never recommend a stop that requires a significant detour from the route. You think like a local expert for every city and state along the route.

Respond with a single valid JSON object only — no markdown fences, no commentary before or after the JSON.

Remember — you are not a generic trip planner. You are a specialized expert for the exact vehicle type on the exact route. Every recommendation must prove you understand the difference between planning for an 18-wheeler versus a family minivan versus a motorcycle versus an RV. Generic suggestions are unacceptable. If you are uncertain about a specific real business at a stop location, recommend the stop city and category instead of inventing a business name.

LIVE DATA SOURCES:
You have access to real-time data from Google Maps for routing and traffic, NREL for EV charging stations, MapQuest for live fuel prices, and Booking.com for hotel availability. Always use live API data when it is available in the request context (including placesContext and any enriched fuel, EV, or lodging fields). When live data is not available, fall back to your trained knowledge of what actually exists along that specific route corridor — never invent businesses.

COMMERCIAL TRUCK STOPS:
At every recommended truck stop, include whether a CAT scale is on site. Professional drivers need to verify load weight at a CAT scale before hitting weigh stations.

SCENIC ROUTES:
When scenic route preference applies, recommend the specific named scenic byway or highway for this corridor — for example Historic Route 66 instead of I-40 through New Mexico, or Highway 1 instead of I-5 through California — with specific towns and stops along that byway that actually exist.

FAMILY TRAVEL:
For family travelers with young children, recommend at least one unexpected fun stop per driving day — a real roadside attraction, unique local landmark, state park with an easy trail, or famous local food spot that is actually on the route and genuinely worth stopping at with kids.

TIPS ARRAY REQUIREMENTS:
Include one regional food culture tip in the tips array that is unique to the area the route passes through — a real well-known local restaurant or food tradition the traveler cannot get at home.
End the tips array with exactly one vehicle-specific preparation tip matched to the trip: truckers — check DOT inspection requirements; RV drivers — check tire pressure and propane; motorcycle riders — check tire pressure, chain tension, and weather gear; families — pack a road trip kit with snacks, entertainment, and a first aid kit.

COMMERCIAL LOAD WARNINGS:
For commercial vehicles, always flag load-specific warnings when applicable: wind advisories for flatbed loads affecting load security; refrigeration unit fuel level reminders for reefer loads; hazmat route restrictions for tanker loads.

If you find yourself writing a generic suggestion that could apply to any route or any vehicle — stop and rewrite it to be specific to this exact trip. A suggestion that would be equally valid for a family driving from Dallas to Los Angeles and a trucker driving from Miami to Seattle is not acceptable. Every line of your response must prove you know exactly who is driving, what they are driving, and where they are going.`;

function buildContextBlock(ctx) {
  const lines = [
    "=== TRIP CONTEXT (reference explicitly throughout your plan) ===",
    `Origin: ${ctx.routeOrigin}`,
    `Destination: ${ctx.routeDestination}`,
    `Total route distance: ${ctx.routeDistance}`,
    `Total estimated drive time: ${ctx.routeDuration}`,
    `Vehicle type: ${ctx.rawVehicle}${ctx.rawVehicle !== ctx.vehicle ? ` (routing vehicle: ${ctx.vehicle})` : ""}`,
    `Fuel type: ${ctx.fuel}`,
    `Traveler type: ${ctx.travelerType}`,
    `Young children on trip: ${ctx.youngKids ? "Yes" : "No"}`,
    `Lodging preference: ${ctx.lodging}`,
    `Trip type: ${ctx.tripType}`,
    `Departure timing: ${ctx.leaveTime}`,
  ];
  if (ctx.preferences.length) lines.push(`Selected preferences: ${ctx.preferences.join(", ")}`);
  if (ctx.routeRestrictions.length) lines.push(`Route restrictions: ${ctx.routeRestrictions.join(", ")}`);
  if (TRUCK_TYPES.includes(ctx.vehicle) || ctx.tripCategory === "commercial") {
    lines.push(`Hauling type: ${ctx.haulingType}`);
    lines.push(`Sleeper cab: ${ctx.sleeperCab}`);
    lines.push(`Preferred truck stop brand: ${ctx.truckStopBrand}`);
    lines.push(`Assumed truck height: ${ctx.truckHeight} · weight: ${ctx.truckWeight} · hazmat: ${ctx.truckHazmat}`);
  }
  if (RV_TYPES.includes(ctx.vehicle)) {
    lines.push(`RV height: ${ctx.rvHeight} · weight: ${ctx.rvWeight} · towing: ${ctx.rvTowing}`);
  }
  if (ctx.rawVehicle === "Multi-Vehicle Trip") {
    lines.push(`Multi-vehicle group: ${ctx.multiVehicles.join(", ") || "Not specified"}`);
    lines.push(`Primary routing vehicle: ${ctx.primaryVehicle || "Not specified"}`);
    if (ctx.coordinationNeeds.length) lines.push(`Coordination needs: ${ctx.coordinationNeeds.join(", ")}`);
  }
  if (ctx.citiesAlongRoute.length) lines.push(`Cities along corridor: ${ctx.citiesAlongRoute.join(" → ")}`);
  if (ctx.legCities.length) lines.push(`Leg cities: ${ctx.legCities.join(" → ")}`);
  if (ctx.dietary.length) lines.push(`Dietary needs: ${ctx.dietary.join(", ")}${ctx.foodAllergies ? ` · allergies: ${ctx.foodAllergies}` : ""}`);
  if (ctx.accessibility.length) lines.push(`Accessibility: ${ctx.accessibility.join(", ")}`);
  if (ctx.stopsInterests.length) lines.push(`Stop interests: ${ctx.stopsInterests.join(", ")}`);
  if (ctx.tripBudget && ctx.tripBudget !== "No budget limit") lines.push(`Total trip budget cap: ${ctx.tripBudget}`);
  if (ctx.towing && ctx.towing !== "No") lines.push(`Towing: ${ctx.towing} — favor routes with trailer parking and avoid tight turns where possible`);
  if (ctx.loyalty && ctx.loyalty !== "No preference") lines.push(`Hotel loyalty: ${ctx.loyalty}`);
  if (ctx.scheduleRestrictions.length) {
    lines.push(`Schedule restrictions: ${ctx.scheduleRestrictions.join(", ")}${ctx.scheduleDriveHours ? ` · preferred hours: ${ctx.scheduleDriveHours}` : ""}`);
  }
  return lines.join("\n");
}

function buildPersonalVehicleBlock(ctx) {
  const isMoto = ctx.vehicle === "Motorcycle";
  const restInterval = isMoto ? "every 90 minutes (rider fatigue is a serious safety concern on two wheels)" : "every 2 hours for cars and SUVs";
  let block = `
=== VEHICLE INSTRUCTIONS: PERSONAL (${ctx.vehicle}) ===
Plan rest stops ${restInterval}.
Recommend real gas stations by brand with approximate fuel price at each fuel stop along the corridor (within 10 miles of the highway).
Recommend roadside attractions, scenic overlooks, state parks, and points of interest actually located along the route corridor within 10 miles of the highway — never far off-route.`;

  if (isMoto) {
    block += `
For this motorcycle trip: favor scenic backroads and state highways over interstates where practical; flag weather warnings for rain, wind, or extreme heat along this specific route; recommend hotels or motels with covered or indoor motorcycle parking at overnight stops.`;
  }

  if (ctx.youngKids) {
    block += `
Family with young children: plan rest stops every 90 minutes maximum; include at least one McDonald's or kid-friendly fast food stop with a play area at each major rest interval; note diaper changing station availability at rest areas; prioritize hotels with pools and kid-friendly amenities; break each driving day into segments no longer than 3 hours; include at least one unexpected fun stop per driving day — a real roadside attraction, landmark, easy state park trail, or famous local kid-friendly food spot on the route.`;
  } else if (ctx.travelerType === "Solo traveler") {
    block += `
Solo traveler: recommend efficient stops that minimize total drive time while still including must-see points along this route.`;
  } else if (ctx.travelerType === "Couple") {
    block += `
Couple: recommend romantic scenic stops, vineyard or winery detours only if genuinely near the corridor, and upscale dining options at overnight stops when lodging preference allows.`;
  }

  if (ctx.isScenic) {
    block += `
Scenic route preference active — name the specific scenic byway or highway for this corridor (e.g. Route 66 vs I-40, Highway 1 vs I-5) with real towns and stops along that byway.`;
  }

  if (ctx.towing && ctx.towing !== "No") {
    block += `
Towing (${ctx.towing}): recommend pull-through fuel lanes and stops with trailer parking; avoid tight downtown areas; note low-clearance or sharp-turn risk at each major stop; space stops closer than a non-towing trip.`;
  }

  if (/electric|tesla|ev/i.test(ctx.fuel)) {
    block += `
Electric vehicle: space charging stops within safe range; ${/tesla/i.test(ctx.fuel) ? "Tesla Supercharger network only when specified." : "include Level 3 DC fast charging where available from placesContext EV list."}`;
  }

  return block;
}

function buildRvBlock(ctx) {
  return `
=== VEHICLE INSTRUCTIONS: RV / CAMPER (${ctx.vehicle}) ===
Treat this as an RV-specific route. Flag every low bridge clearance along the route that could affect a vehicle taller than 11 feet (use assumed height ${ctx.rvHeight}).
Flag every steep grade above 6% that requires engine braking and could stress the RV drivetrain.
Flag every narrow road or restricted parkway that prohibits vehicles over length limits.
Flag state or city RV overnight parking restrictions where relevant.
Always recommend RV parks and campgrounds as primary overnight options: full hookup sites first, partial hookup second, dry camping or Walmart overnight only as last-resort backup — NEVER recommend hotels or motels for RV travelers.
Include at least one propane refill stop recommendation per 300 miles of route.
Include dump station locations at or near each overnight stop.
Note estimated generator fuel consumption for dry camping nights when applicable.
Note national park RV size restrictions if this route passes near a national park.
Recommend high-clearance fuel stops; include DEF for diesel RVs when fuel type is diesel.`;
}

function buildCommercialBlock(ctx) {
  const isTanker = ctx.vehicle === "Tanker" || ctx.haulingType?.toLowerCase().includes("tanker") || ctx.haulingType?.toLowerCase().includes("hazmat");
  const isReefer = ctx.haulingType?.toLowerCase().includes("refrigerat") || ctx.haulingType?.toLowerCase().includes("reefer");
  const isFlatbed = ctx.vehicle === "Flatbed" || ctx.haulingType?.toLowerCase().includes("flatbed");
  const noSleeper = /no|without|motel/i.test(String(ctx.sleeperCab));

  return `
=== VEHICLE INSTRUCTIONS: COMMERCIAL (${ctx.vehicle}) ===
Treat this as a professional commercial driving route with full FMCSA HOS compliance on every stop.
Driver limits: 11 hours driving per day; mandatory 30-minute break after 8 consecutive hours driving; minimum 10-hour rest at each overnight stop before driving resumes.
Using total distance ${ctx.routeDistance} and drive time ${ctx.routeDuration}, calculate exact driving segments and flag precisely where the mandatory 30-minute break must occur and where each overnight stop must occur to remain HOS compliant.
Never recommend a stop that would put the driver over hours-of-service limits.
Always recommend truck stops as primary overnight stops${noSleeper ? " — include motel rooms near truck stops because driver has no sleeper cab" : " — do not default to hotels when sleeper cab is available"}.
At every truck stop: include brand (prioritize preferred brand "${ctx.truckStopBrand}" when set), estimated truck parking spaces, showers (and approximate shower cost), laundry availability, diesel price per gallon when known, on-site food options, and whether a CAT scale is on site (required — drivers verify weight before weigh stations).
Flag every weigh station along this route by state and approximate mile marker.
Flag every low bridge below 14 feet clearance.
Flag weight-restricted roads or bridges on this route.
Include rest areas with truck parking as supplemental stops between main truck stops (note approximate truck spaces).
Include a full hos_compliance summary in JSON showing total drive time, mandatory break time and location, overnight stop time and location, and total trip completion time across multiple days if needed.
Set truck_safe_route: true in the JSON response.
${isTanker || ctx.truckHazmat === "Yes" ? "Hazmat/tanker load: flag hazmat route restrictions and inspection requirements along this corridor." : ""}
${isReefer ? "Refrigerated load: flag stops where driver should check refrigeration unit fuel levels." : ""}
${isFlatbed ? "Flatbed load: flag high wind advisory areas that could affect load securement." : ""}`;
}

function buildWaterBlock() {
  return `
=== VEHICLE INSTRUCTIONS: BOAT / FERRY ===
Provide departure port recommendations near the origin, arrival port recommendations near the destination, marina stops along the water route if applicable, fuel dock locations, weather and water condition warnings for travel dates when inferable, and tide notes for coastal routes.
Always include in tips that Google Maps does not support marine routing and the map route shown is approximate.`;
}

function buildPlaneBlock() {
  return `
=== VEHICLE INSTRUCTIONS: PLANE ===
Recommend the best airport near the origin with ground transport options, layover city recommendations if a connecting flight is logical for this distance, the best airport near the destination with ground transport, hotel recommendations near the destination airport for the first night, and activity and restaurant recommendations at the destination.`;
}

function buildMultiBlock(ctx) {
  return `
=== VEHICLE INSTRUCTIONS: MULTI-VEHICLE TRIP ===
Vehicles in group: ${ctx.multiVehicles.join(", ") || "unspecified"}. Primary routing vehicle: ${ctx.primaryVehicle || "unspecified"}.
Identify stops that work logistically for every vehicle type in the group.
Flag route conflicts where one vehicle has restrictions others do not (e.g. low bridge affecting RV but not cars).
Recommend meeting-point stops where the group can reconvene if routes diverge.
Note coordination logistics (e.g. RV must take longer route to avoid restricted road while cars use direct highway).`;
}

function buildUniversalRules(ctx, placesContextPrompt) {
  const maxDayPersonal = ctx.youngKids ? "6 hours for families with young children" : "8 hours for personal vehicles";
  const maxDay = ctx.tripCategory === "commercial" ? "11 hours for commercial vehicles" : maxDayPersonal;

  const lodgingRules = ctx.continuousDrive
    ? "NO OVERNIGHT STOPS: User chose continuous drive — return an empty stops array. Do not recommend hotels or lodging. Space fuel and rest road_stops across the full drive."
    : `HOTELS: Every hotel must be in the correct overnight stop city on this route — never a city off the corridor. At each overnight stop provide at least 3 lodging options sorted by lodging preference (${ctx.lodging}): budget / mid-range / luxury as applicable.
RESTAURANTS: At each overnight stop include at least 2 restaurants — one sit-down and one fast food or quick option — in that same stop city.
SPACING: Space overnight stops evenly; no single driving day exceeds ${maxDay}.`;

  let scheduleRules = "";
  if (ctx.scheduleRestrictions?.length) {
    scheduleRules = `\nSCHEDULE RESTRICTIONS (mandatory):
${ctx.scheduleRestrictions.join("; ")}${ctx.scheduleDriveHours ? `\nPreferred driving hours: ${ctx.scheduleDriveHours}` : ""}
- Adjust driving day boundaries so restricted days have no driving segments.
- Place overnight stops BEFORE a restricted day begins when needed.`;
  }

  let dietaryRules = "";
  if (ctx.dietary?.length) {
    dietaryRules = `\nDIETARY (mandatory for restaurant picks): ${ctx.dietary.join(", ")}${ctx.foodAllergies ? ` — allergy: ${ctx.foodAllergies}` : ""}
- Only recommend restaurants that match these dietary needs at each stop city.`;
  }

  let medicalRules = "";
  const med = ctx.accessibility || [];
  if (med.some(a => /pharmacy|refrigerated/i.test(a))) {
    medicalRules += "\n- Flag pharmacy access at overnight stops for refrigerated medication.";
  }
  if (med.some(a => /dialysis/i.test(a))) {
    medicalRules += "\n- Note dialysis center access within 10 miles of each overnight stop.";
  }
  if (med.some(a => /pet|veterinary|sick pet/i.test(a))) {
    medicalRules += "\n- Note veterinary or emergency animal hospital access near overnight stops.";
  }
  if (med.some(a => /wheelchair.*lodging/i.test(a))) {
    medicalRules += "\n- Lodging must be wheelchair accessible with roll-in showers where possible.";
  }

  return `
=== UNIVERSAL RULES (every trip) ===
${placesContextPrompt || ""}
PLACES DATA RULE: For road_stops and named businesses, use ONLY verified names from placesContext in this request. Never invent business names. If placesContext has no match, use stop city and category only — do NOT fabricate a brand name.
CORRIDOR RULE: Every stop must be a real place along the driving corridor between ${ctx.routeOrigin} and ${ctx.routeDestination}, within 10 miles of the highway — no significant detours.
CITY FORMAT: Every stop city as "City, ST" (full city name and two-letter state).
${lodgingRules}${scheduleRules}${dietaryRules}${medicalRules}
BUDGET: ${ctx.tripBudget && ctx.tripBudget !== "No budget limit" ? `Keep total estimated trip cost under ${ctx.tripBudget} — favor budget-appropriate stops and lodging.` : "No hard budget cap."}
TIPS: Include tips array with 5–8 genuinely useful tips specific to THIS route and vehicle — not generic advice (e.g. name a specific weigh station mile marker on I-40, not "check tire pressure"). Include one regional food culture tip unique to this corridor. End tips with one vehicle-specific preparation tip (DOT inspection for truckers, tire/propane for RV, tire/chain/weather for motorcycle, road-trip kit for families).
ROAD CONDITIONS: Include road_condition_warnings array for mountain passes, desert heat, winter weather, or construction zones actually relevant to this specific route.
ORDER: Stops must progress geographically from origin toward destination; distance and eta fields must increase logically.
ANTI-HALLUCINATION: If uncertain whether a business exists, output the city and category without a business name.`;
}

function buildLodgingRules(lodging) {
  const rules = {
    Budget: "Budget only: 1–2 star hotels/motels under $80/night.",
    "Mid-Range": "Mid-range only: solid 3-star hotels $80–$150/night.",
    Luxury: "Luxury only: 4–5 star hotels over $150/night with strong ratings.",
    "Airbnb or Vacation Rental": "Vacation rentals and whole-home stays — not standard hotels.",
    "Camping or Outdoors": "Campgrounds and outdoor stays only.",
    "Sleeper cab — no hotel needed": "No hotel stops — truck stop parking only.",
    "Doesn't Matter": "Any suitable lodging tier in each stop city.",
  };
  return rules[lodging] || rules["Mid-Range"];
}

function buildJsonSchema(ctx, isSimplified) {
  if (isSimplified) {
    const continuousNote = ctx.continuousDrive
      ? `\nCONTINUOUS DRIVE: User is driving straight through with no overnight stops. Return empty stops array if present. Prioritize road_stops with category fuel and rest spaced for long-haul driving. First tip must note total drive time is ${ctx.routeDuration}.`
      : "";
    return `Return JSON:
{
  "trip_format": "simplified",
  "route_summary": "One sentence specific to this route and vehicle",
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|food|rest", "name": "From placesContext or category", "note": "Route-specific short note" }],
  "recommendations": [{ "name": "From placesContext", "category": "Activity|Dining|Viewpoint", "rating": "4.5", "note": "Why stop here on THIS route" }],
  "tips": ["5-8 route-specific tips"],
  "road_condition_warnings": ["Warning specific to this route"]
}${continuousNote}`;
  }

  if (ctx.tripCategory === "commercial") {
    return `Return JSON with trip_format "multi_day":
{
  "trip_format": "multi_day",
  "truck_safe_route": true,
  "hos_compliance": {
    "totalDriveTime": "${ctx.routeDuration}",
    "mandatoryBreakTime": "30 min",
    "mandatoryBreakLocation": "City, ST",
    "overnightStopTime": "10 hours minimum",
    "overnightStopLocation": "City, ST",
    "totalTripCompletionTime": "e.g. 2 days 6 hours",
    "drivingDays": 1,
    "overnightStopsRequired": 0
  },
  "stops": [{
    "city": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "why": "HOS or route reason", "type": "overnight|break",
    "truckStop": { "name": "From placesContext", "spaces": 120, "showers": true, "showerCost": "$12", "laundry": true, "restaurant": true, "diesel": "$3.89/gal", "hours": "24/7", "catScale": true },
    "motel": { "name": "Only if no sleeper", "price": "$69/night", "distance": "0.5 mi", "parking": "Rig parking" },
    "restArea": { "name": "Rest area", "spaces": 24, "distance": "10 mi", "amenities": "Truck parking · restrooms" },
    "fuelStops": [{ "name": "From placesContext", "location": "City, ST", "distance": "XXX mi", "diesel": "$3.89/gal", "amenities": "Showers · CAT scales · DEF" }]
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|rest", "name": "From placesContext", "note": "Short note" }],
  "safety": {
    "weighStations": [{ "state": "TX", "location": "I-40 mile marker", "hours": "24/7" }],
    "lowBridges": [{ "name": "Bridge", "clearance": "13'6\\"", "location": "City, ST" }],
    "steepGrades": [{ "location": "Pass name", "grade": "7%", "note": "Reduce speed" }],
    "hazmatRestrictions": [],
    "weightRestrictions": []
  },
  "tips": ["5-8 commercial route-specific tips"],
  "road_condition_warnings": []
}`;
  }

  if (ctx.tripCategory === "rv") {
    return `Return JSON with trip_format "multi_day":
{
  "trip_format": "multi_day",
  "stops": [{
    "city": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "why": "RV reason", "type": "overnight",
    "rvPark": { "name": "From placesContext", "fullHookups": 40, "amp30": true, "amp50": true, "pullThrough": 25, "backIn": 15, "maxLength": "45 ft", "amenities": "WiFi · pool · dump", "rate": "$55/night" },
    "campground": { "name": "From placesContext", "maxLength": "40 ft", "hookups": "Water & electric", "distanceFromHighway": "8 mi", "reservation": "Required or FCFS" },
    "freeParking": { "name": "Last resort only", "type": "Walmart", "note": "Confirm before arrival", "distance": "2 mi" },
    "fuelStops": [{ "name": "From placesContext", "location": "City, ST", "distance": "XXX mi", "fuel": "Gas/diesel", "highClearance": true, "def": true, "rvFriendly": true, "amenities": "High clearance · DEF" }]
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel", "name": "From placesContext", "note": "Short note" }],
  "safety": { "lowBridges": [], "steepGrades": [], "sharpCurves": [], "propaneLocations": [], "dumpStations": [], "rvParkingRestrictions": [] },
  "tips": ["5-8 RV route-specific tips"],
  "road_condition_warnings": []
}`;
  }

  if (ctx.tripCategory === "water") {
    return `Return JSON:
{
  "trip_format": "simplified",
  "route_summary": "Marine route overview with disclaimer",
  "road_stops": [{ "location": "Port City, ST", "distance": "—", "eta": "—", "category": "rest", "name": "Port or marina", "note": "Marine-specific note" }],
  "tips": ["Include Google Maps marine routing disclaimer", "5-8 water-specific tips"],
  "road_condition_warnings": []
}`;
  }

  if (ctx.tripCategory === "plane") {
    return `Return JSON:
{
  "trip_format": "simplified",
  "route_summary": "Flight plan overview",
  "road_stops": [{ "location": "Airport area", "distance": "—", "eta": "—", "category": "rest", "name": "Airport or transport hub", "note": "Ground transport tip" }],
  "recommendations": [{ "name": "Destination activity or restaurant", "category": "Activity|Dining", "rating": "4.5", "note": "Why at destination" }],
  "tips": ["5-8 flight and destination tips"],
  "road_condition_warnings": []
}`;
  }

  if (ctx.tripCategory === "multi") {
    return `Return JSON with trip_format "multi_day" — include coordination notes in tips and stops:
{
  "trip_format": "multi_day",
  "stops": [{ "city": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "why": "Group stop", "type": "overnight|meeting",
    "hotels": [{ "name": "From placesContext", "stars": 3, "price": "$99/night" }],
    "coordinationNote": "Which vehicles this stop serves"
  }],
  "road_stops": [],
  "tips": ["Multi-vehicle coordination tips"],
  "road_condition_warnings": []
}`;
  }

  const restaurantShape =
    ctx.preferences.includes("Fast food only") || ctx.preferences.includes("Sit down restaurants only")
      ? `[{ "name": "Restaurant in stop city", "cuisine": "Type", "rating": "4.5", "time": "7 PM", "kidFriendly": true }]`
      : `[{ "name": "Sit-down in stop city", "cuisine": "Type", "rating": "4.5", "time": "7 PM" }, { "name": "Quick option", "cuisine": "Fast casual", "rating": "4.2", "time": "flexible" }]`;

  return `Return JSON with trip_format "multi_day":
{
  "trip_format": "multi_day",
  "stops": [{
    "city": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "why": "5 words max", "type": "overnight",
    "hotels": [
      { "name": "From placesContext or tier-appropriate", "stars": 3, "price": "$99/night", "pet": false, "kidFriendly": ${ctx.youngKids} },
      { "name": "Second option", "stars": 3, "price": "$109/night" },
      { "name": "Third option", "stars": 4, "price": "$149/night" }
    ],
    "restaurants": ${restaurantShape},
    "scenicView": ${ctx.isScenic ? '"Specific overlook on this route"' : "null"}
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|food|rest", "name": "From placesContext", "note": "Route-specific note" }],
  "tips": ["5-8 route- and vehicle-specific tips"],
  "road_condition_warnings": []
}`;
}

function buildUserPrompt(ctx, placesContextPrompt, isSimplified, generationHints = "") {
  let vehicleBlock;
  switch (ctx.tripCategory) {
    case "commercial":
      vehicleBlock = buildCommercialBlock(ctx);
      break;
    case "rv":
      vehicleBlock = buildRvBlock(ctx);
      break;
    case "water":
      vehicleBlock = buildWaterBlock();
      break;
    case "plane":
      vehicleBlock = buildPlaneBlock();
      break;
    case "multi":
      vehicleBlock = buildMultiBlock(ctx);
      break;
    default:
      vehicleBlock = buildPersonalVehicleBlock(ctx);
  }

  const extras = [];
  if (ctx.preferences.includes("Pet friendly")) extras.push("Pet-friendly hotels and pet relief areas at rest stops.");
  if (ctx.preferences.includes("EV charging stops")) extras.push("Prioritize EV fast-charging stations along corridor.");
  if (ctx.preferences.includes("Kid friendly stops")) extras.push("Playgrounds and family restrooms at rest stops.");
  if (ctx.preferences.includes("Avoid tolls") || ctx.routeRestrictions.includes("Avoid tolls")) extras.push("Avoid toll roads where alternatives exist.");
  if (ctx.preferences.includes("Avoid highways")) extras.push("Favor non-interstate highways when practical.");

  return `${buildContextBlock(ctx)}

${vehicleBlock}

${buildUniversalRules(ctx, placesContextPrompt)}
${generationHints ? `\n${generationHints}\n` : ""}

Lodging tier for this trip: ${ctx.continuousDrive ? "No overnight stay — continuous drive mode" : buildLodgingRules(ctx.lodging)}
${extras.length ? `Additional preference notes:\n${extras.map(e => `- ${e}`).join("\n")}` : ""}
${ctx.continuousDrive ? `\nCONTINUOUS DRIVE MODE: User chose to drive straight through (${ctx.routeDuration} total). No hotels, motels, or overnight city stops. Focus road_stops on fuel stations and rest areas for long-haul driving.` : ""}
${isSimplified ? `\nSHORT TRIP: Distance ${ctx.routeDistance} — use simplified single-page format; no overnight hotel stops unless essential.` : ""}

Plan this trip now. Reference the origin, destination, distance (${ctx.routeDistance}), drive time (${ctx.routeDuration}), vehicle (${ctx.vehicle}), fuel (${ctx.fuel}), and traveler profile (${ctx.travelerType}) in your route_summary, stops, and tips.

${buildJsonSchema(ctx, isSimplified)}

Remember — you are not a generic trip planner. You are a specialized expert for this exact vehicle type on this exact route. Every recommendation must prove that you understand the difference between planning a trip for an 18-wheeler versus a family minivan versus a motorcycle versus an RV. Generic suggestions are unacceptable. If you are uncertain about a specific real business at a stop location, recommend the stop city and category instead of inventing a business name.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  const admin = user ? getSupabaseAdmin() : null;
  if (user && admin) {
    try {
      const status = await fetchCreditStatus(admin, user.id);
      if (!status.unlimited && status.remaining <= 0) {
        return res.status(402).json({
          error: "No Trip Generations remaining this month",
          code: "no_credits",
          credits: status,
        });
      }
    } catch (creditErr) {
      console.error("Credit check failed:", creditErr);
      return res.status(500).json({ error: "Could not verify trip credits" });
    }
  }

  const { origin, destination, answers, model = "claude-sonnet-4-6", placesContextPrompt = "", generationHints = "" } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  const ctx = buildTripContext(req.body);

  const tripType = answers?.trip_type || "Road trip";
  const continuousDrive =
    answers?.continuous_drive === true
    || answers?.overnight_preference === "Drive straight through";
  const needsOvernight =
    !continuousDrive &&
    !["Day trip", "Driving home"].includes(tripType) &&
    answers?.lodging !== "No overnight stay" &&
    answers?.lodging !== "Sleeper cab — no hotel needed";
  const isSimplifiedFormat =
    ["Day trip", "Driving home"].includes(tripType) ||
    (ctx.routeMiles > 0 && ctx.routeMiles < 150) ||
    !needsOvernight ||
    ctx.tripCategory === "water" ||
    ctx.tripCategory === "plane";

  const userPrompt = buildUserPrompt(ctx, placesContextPrompt, isSimplifiedFormat, generationHints);
  const maxTokens =
    ctx.tripCategory === "commercial" || ctx.tripCategory === "rv" ? 4096 : isSimplifiedFormat ? 1800 : 3200;

  try {
    let parsed = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { response, data } = await callAnthropic(model, SYSTEM_PROMPT, userPrompt, maxTokens);
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 529;
        if (retryable && attempt === 0) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        return res.status(500).json({ error: data.error?.message || "API error" });
      }

      const text = data?.content?.[0]?.text;
      try {
        parsed = parseJsonFromLlm(text);
      } catch {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        return res.status(502).json({ error: "Trip planner returned invalid data" });
      }

      parsed.trip_format = isSimplifiedFormat ? "simplified" : parsed.trip_format || "multi_day";

      if (!tripResponseHasContent(parsed) && attempt === 0) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      if (!tripResponseHasContent(parsed)) {
        return res.status(502).json({ error: "Trip planner returned incomplete results" });
      }
      break;
    }

    if (user && admin) {
      const hasContent = tripResponseHasContent(parsed);
      if (hasContent) {
        try {
          await consumeCredit(admin, user.id);
        } catch (creditErr) {
          console.error("Credit consumption after success failed:", creditErr);
        }
      }
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Plan trip error:", err);
    return res.status(500).json({ error: "Failed to generate trip plan" });
  }
}
