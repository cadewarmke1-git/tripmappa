/** Active trip-generation endpoint (Anthropic Sonnet). Called via src/lib/apiClient.js only. */
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import {
  fetchCreditStatus,
  consumeCredit,
  preflightCreditFromClient,
  validateCreditsBeforeConsume,
} from "../lib/tripCredits.js";
import {
  initPlanTripSse,
  writePlanTripSse,
  streamAnthropicMessages,
  createPlanTripSseWriter,
} from "../lib/planTripStream.js";
import {
  buildTripSegments,
  stitchTripSegments,
  shouldUseParallelTripSegments,
} from "../lib/planTripSegments.js";
import { readUserTripPreferences, formatPreferencesForPrompt } from "./user-trip-preferences.js";
import { calculateMaxTokens } from "../lib/planTripTokens.js";
import { normalizeTripResponse } from "../lib/tripResponseNormalize.js";
import { buildCorridorDistributionRules } from "../lib/corridorStopDistribution.js";
import {
  parseTravelerCount,
  isGroupTravelersBand,
  isSoloTraveler,
  formatTravelersLabel,
} from "../../src/lib/vehicles.js";
import { isTowingSelected } from "../../src/lib/tripAccommodations.js";
import { buildGenerationLogRow, logGenerationUsage } from "../lib/generationLogs.js";
import { logPlanTripDev } from "../lib/apiLog.js";
import {
  clampString,
  PLAN_TRIP_MODELS,
  PROMPT_FIELD_MAX,
  resolveAllowedModel,
} from "../lib/apiSecurity.js";
import {
  buildCorridorPlacesFallback,
  requireAuthenticatedUser,
  requireTripMappaClient,
  validatePlanTripPayload,
} from "../lib/planTripGuard.js";
import {
  checkPlanTripRateLimit,
  getClientIp,
  recordPlanTripRateLimitHit,
} from "../lib/planTripRateLimit.js";
import { parseJsonFromLlm } from "../lib/parseJsonFromLlm.js";
import { initServerSentry, Sentry } from "../lib/sentry.js";

function tripResponseHasContent(parsed) {
  const stops = Array.isArray(parsed?.stops)
    ? parsed.stops.filter(s => s && (s.city || s.name))
    : [];
  const roadStops = Array.isArray(parsed?.road_stops)
    ? parsed.road_stops.filter(s => s && (s.name || s.city))
    : [];
  return stops.length > 0 || roadStops.length > 0;
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
  if (isSoloTraveler(t)) return "Solo traveler";
  if ((t === "2" || t === "2 travelers") && !youngKids) return "Couple";
  if (isGroupTravelersBand(t)) return youngKids ? "Family group" : "Group travelers";
  if (elderly) return "Travelers including elderly passengers";
  return formatTravelersLabel(t) || "Not specified";
}

function classifyTrip(answers, vehicle, rawVehicle) {
  if (rawVehicle === "Multi-Vehicle Trip") return "multi";
  if (vehicle === "Plane" || rawVehicle === "Plane" || answers?.trip_type === "Flying") return "plane";
  if (WATER_TYPES.includes(vehicle) || WATER_TYPES.includes(rawVehicle) || answers?.trip_type === "Ferry or Cruise") return "water";
  if (TRUCK_TYPES.includes(vehicle) || answers?.trip_type === "Work or Delivery run") return "commercial";
  if (RV_TYPES.includes(vehicle)) return "rv";
  return "personal";
}

function pickPlanTripContextBody(body, mergedAnswers) {
  return {
    origin: body.origin,
    destination: body.destination,
    answers: mergedAnswers,
    routeInfo: body.routeInfo,
    legs: body.legs,
    departureTime: body.departureTime,
    timingMode: body.timingMode,
  };
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
    truckRestrictions: Array.isArray(routeInfo.restrictions) ? routeInfo.restrictions : [],
    weighStationCount: Array.isArray(routeInfo.weighStations) ? routeInfo.weighStations.length : 0,
    partySize: parseTravelerCount(answers.travelers),
  };
}

const SYSTEM_PROMPT = `You are TripMappa's expert AI trip planner. You have deep knowledge of US highways, road conditions, vehicle-specific routing requirements, HOS regulations for commercial drivers, RV travel, motorcycle travel, family road trips, and general travel planning.

You never give generic suggestions. Every single recommendation must be specific to the exact route, vehicle type, traveler type, and distance provided in the user message.

You always recommend real places that actually exist along the route corridor. You never recommend a stop that requires a significant detour from the route. You think like a local expert for every city and state along the route.

Respond with only valid JSON: a single JSON object and nothing else. No preamble, no markdown code blocks, no backticks, and no extra text before or after the JSON object. Do not wrap the JSON in \`\`\`json fences. Your entire response must be raw JSON parseable by JSON.parse().

Remember — you are not a generic trip planner. You are a specialized expert for the exact vehicle type on the exact route. Every recommendation must prove you understand the difference between planning for an 18-wheeler versus a family minivan versus a motorcycle versus an RV. Generic suggestions are unacceptable. If you are uncertain about a specific real business at a stop location, recommend the stop city and category instead of inventing a business name.

LIVE DATA SOURCES:
You have access to real-time data from Google Maps for routing, traffic, and places, NREL for EV charging stations, EIA for regional fuel price estimates, and Booking.com for hotel availability. Always use live API data when it is available in the request context (including placesContext and any enriched fuel, EV, or lodging fields). When live data is not available, fall back to your trained knowledge of what actually exists along that specific route corridor — never invent businesses.

COMMERCIAL TRUCK STOPS:
At every recommended truck stop, include whether a CAT scale is on site. Professional drivers need to verify load weight at a CAT scale before hitting weigh stations.

SCENIC ROUTES:
When scenic route preference applies, recommend the specific named scenic byway or highway for this corridor — for example Historic Route 66 instead of I-40 through New Mexico, or Highway 1 instead of I-5 through California — with specific towns and stops along that byway that actually exist.

FAMILY TRAVEL:
For family travelers with young children, recommend at least one unexpected fun stop per driving day — a real roadside attraction, unique local landmark, state park with an easy trail, or famous local food spot that is actually on the route and genuinely worth stopping at with kids.

TIPS ARRAY REQUIREMENTS:
Each tip is an object: { "severity": "info"|"advisory"|"action", "title": "one line", "detail": "one line", "action": { "type": "reroute"|"depart_earlier", "label": "button label" } } — include action only when severity is "action".
Emit 5–8 tips total. At most TWO tips may use severity "action"; each action tip must have a one-line title and one-line detail.
Never include bare temperature readings or clear-sky weather observations. Mention weather ONLY when it changes a decision (storms in a time window, heat affecting EV range while towing, snow on mountain grades, high winds for RVs).
Include one regional food culture tip (severity "info") unique to the corridor. End with one vehicle-specific preparation tip (severity "info"): truckers — DOT inspection; RV — tire pressure and propane; motorcycle — tire, chain, weather gear; families — road trip kit.

COMMERCIAL LOAD WARNINGS:
For commercial vehicles, always flag load-specific warnings when applicable: wind advisories for flatbed loads affecting load security; refrigeration unit fuel level reminders for reefer loads; hazmat route restrictions for tanker loads.

If you find yourself writing a generic suggestion that could apply to any route or any vehicle — stop and rewrite it to be specific to this exact trip. A suggestion that would be equally valid for a family driving from Dallas to Los Angeles and a trucker driving from Miami to Seattle is not acceptable. Every line of your response must prove you know exactly who is driving, what they are driving, and where they are going.`;

const TRUCK_PARKING_RULES = `TRUCK PARKING (commercial routes):
- Add truck_parking:true/false on every restaurant and food road_stop.
- truck_parking:true ONLY if the restaurant is at a truck stop, shares a lot with truck parking, or is within 0.3 miles walking of verified truck parking.
- When unsure, default truck_parking:false and recommend the truck stop's own food instead.`;

function buildSystemPrompt(ctx) {
  const maxDayPersonal = ctx.youngKids ? "6 hours" : "8 hours";
  const driveCap = ctx.tripCategory === "commercial" ? "11 hours" : maxDayPersonal;
  const requiredBand = lodgingTierToPriceBand(ctx.lodging) || "matching user lodging tier";
  const truckChecklist = ctx.tripCategory === "commercial"
    ? ", (5) every truck restaurant and road_stop food recommendation has truck_parking:true when at or adjacent to verified truck parking (default false when unsure)"
    : "";

  return `${SYSTEM_PROMPT}

PRICE_BAND DEFINITIONS (every hotel MUST match user lodging tier "${ctx.lodging}"):
- budget: under $80/night
- mid: $90–$160/night
- luxury: $200+/night
Required price_band for this trip: ${requiredBand}. ${buildLodgingRules(ctx.lodging)}

STOP AND RESTAURANT NAMES (mandatory):
- Use business names EXACTLY as they appear in the VERIFIED PLACES list — character-for-character, no paraphrasing.
- NEVER invent, guess, or embellish stop names (no "corridor", "vicinity", or planning jargon in user-visible names).
- Every road_stop must be a real named business that would appear on Google Maps — never a generic description like "rest stop near X", "drive-through near Y", or "dining near Z".
- Food stops on any route must always use the actual business name from VERIFIED PLACES.
- HARD RULE: If a specific named business cannot be identified for a stop, omit the stop entirely rather than using a generic placeholder description.

RESTAURANT VERIFICATION (every restaurant object):
- verified:true ONLY when the name exists in VERIFIED PLACES from placesContext.
- verified:false when no verified option fits — include verification_note (one phrase) explaining why.
- Never invent a brand name; use city + cuisine when unverified.
- Food stops MUST be actual restaurants/cafes/bakeries/bars from VERIFIED PLACES — never car dealers, hotels, or repair shops in food slots.

${ctx.tripCategory === "commercial" ? `${TRUCK_PARKING_RULES}\n` : ""}
${PERSONAL_TOUCHES_PROMPT}

Before responding verify: (1) every restaurant is from VERIFIED PLACES or flagged with verified:false and verification_note, (2) every hotel price_band matches the requested lodging tier, (3) no segment exceeds the ${driveCap} drive-time cap for this trip type, (4) no national chain appears unless drive-through was requested${truckChecklist}, (6) personal_touches has 2-4 specific warm sentences tied to this traveler.`;
}

function lodgingTierToPriceBand(lodging) {
  if (lodging === "Budget") return "budget";
  if (lodging === "Mid-Range") return "mid";
  if (lodging === "Luxury") return "luxury";
  return "tier-appropriate (budget, mid, or luxury)";
}

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
    if (ctx.truckRestrictions?.length) {
      lines.push(`HERE truck route restrictions along corridor: ${ctx.truckRestrictions.map(r => `${r.roadName ? r.roadName + ": " : ""}${r.message}`).join("; ")}`);
    }
    if (ctx.weighStationCount > 0) {
      lines.push(`HERE weigh stations along route: ${ctx.weighStationCount} identified — cite at most 3 most relevant per leg in output`);
    }
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
  if (isTowingSelected({ towing: ctx.towing })) lines.push(`Towing: ${ctx.towing} — favor routes with trailer parking and avoid tight turns where possible`);
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

  if (isTowingSelected({ towing: ctx.towing })) {
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
Treat this as a professional commercial driving route with FMCSA HOS compliance on every stop.
Driver limits: 11 hours driving per day; mandatory 30-minute break after 8 consecutive hours driving; minimum 10-hour rest at each overnight stop before driving resumes.
Using total distance ${ctx.routeDistance} and drive time ${ctx.routeDuration}, place the mandatory 30-minute break and each overnight stop to remain HOS compliant. Never recommend a stop that would put the driver over hours-of-service limits.
${noSleeper ? "No sleeper cab — include up to 2 motels near the overnight truck stop (override universal 3-hotel minimum)." : "Sleeper cab available — truck stop parking for overnight; do not default to hotels."}
TRUCK STOPS: At most 3 fuel/rest road_stops per leg. Road stops must be named truck-friendly facilities: Love's Travel Stop, Pilot Flying J, Flying J, TA Travel Center, Petro Stopping Center, Sapp Bros, or Buc-ee's — prioritize preferred brand "${ctx.truckStopBrand}" when set. Never use generic descriptions; omit the stop if no named facility can be identified. Per stop: brand, location, CAT scale yes/no, diesel price if known, and one short amenities line (showers/laundry/food). Do not add supplemental rest-area stops unless one is required for the HOS break.
WEIGH STATIONS: At most 3 per leg in safety.weighStations — only the most relevant on this segment (state + highway + approximate mile marker, one line each). Do not list every weigh station on the corridor.
HOS: One concise hos_compliance string per leg (3–5 sentences) covering drive time, mandatory break location, overnight location, and rest requirements. No nested HOS objects or per-stop compliance breakdowns.
MOTELS: At most 2 motel options per overnight city when motels are needed — name, price, and one-line parking note each.
SAFETY: Include all relevant low-bridge, weight-restriction, and load-specific warnings; each entry is one line only — no multi-line notes.
Do not repeat truck height, weight, hazmat status, or other vehicle specs in JSON output — they are already in trip context above.
Set truck_safe_route: true in the JSON response.
Keep this leg's JSON under 3500 tokens — concise values, no redundant prose.
${isTanker || ctx.truckHazmat === "Yes" ? "Hazmat/tanker: one-line hazmat route or inspection warnings only where applicable." : ""}
${isReefer ? "Reefer load: one-line reminder to check reefer unit fuel at fuel stops." : ""}
${isFlatbed ? "Flatbed load: one-line high-wind advisory where applicable." : ""}`;
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

const PERSONAL_TOUCHES_PROMPT = `PERSONAL_TOUCHES (required JSON array — 2-4 warm human sentences):
Populate personal_touches with short, friendly lines explaining specific personalization choices for THIS trip. Reference the TRAVELER DOSSIER, current answers, and trip history — never generic filler.
Good examples:
- "Added a dog-friendly patio at every lunch stop because you're traveling with a pet"
- "Kept drive segments under 2 hours with playground breaks because you have young children"
- "Chose BBQ-forward stops based on your past trips"
- "Skipped seafood options based on your travel history"
- "Selected pet-friendly hotels at every overnight stop"
Bad examples: "Family friendly trip", "Good restaurants along the route"`;

const SCHEMA_PERSONAL_TOUCHES = `"personal_touches": ["2-4 warm human sentences per PERSONAL_TOUCHES rules above"]`;

function buildVerificationChecklist(ctx) {
  return `
=== USER-PROMPT REMINDERS ===
- VERIFIED PLACES list in placesContext is authoritative for business names.
- Stops must progress from ${ctx.routeOrigin} toward ${ctx.routeDestination}.
- ${SCHEMA_PERSONAL_TOUCHES.replace(/"/g, "")} — not generic filler.`;
}

function buildUniversalRules(ctx, placesContextPrompt) {
  const maxDayPersonal = ctx.youngKids ? "6 hours for families with young children" : "8 hours for personal vehicles";
  const maxDay = ctx.tripCategory === "commercial" ? "11 hours for commercial vehicles" : maxDayPersonal;

  const lodgingRules = ctx.continuousDrive
    ? "NO OVERNIGHT STOPS: User chose continuous drive — return an empty stops array. Do not recommend hotels or lodging. Space fuel and rest road_stops across the full drive."
    : `HOTELS: Every hotel must be in the correct overnight stop city on this route — never a city off the corridor. At each overnight stop provide at least 3 lodging options matching lodging tier (${ctx.lodging}): ${buildLodgingRules(ctx.lodging)} Include price_band (budget|mid|luxury) and verified on each hotel.
RESTAURANTS: At each overnight stop include at least 2 restaurants — one sit-down and one fast food or quick option — in that same stop city. Include verified on each.
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
${buildCorridorDistributionRules({ ...ctx, routeDistanceMiles: ctx.routeMiles })}
PLACES DATA RULE: For road_stops and named businesses, use ONLY verified names from placesContext in this request. Never invent business names. Every road_stop must be a real named business on Google Maps — never generic "near X" descriptions. If no verified named business fits, omit the road_stop entirely.
CORRIDOR RULE: Every stop must be a real place along the driving corridor between ${ctx.routeOrigin} and ${ctx.routeDestination}, within 10 miles of the highway — no significant detours.
CITY FORMAT: Every stop city as "City, ST" (full city name and two-letter state).
${lodgingRules}${scheduleRules}${dietaryRules}${medicalRules}
BUDGET: ${ctx.tripBudget && ctx.tripBudget !== "No budget limit" ? `Keep total estimated trip cost under ${ctx.tripBudget} — favor budget-appropriate stops and lodging.` : "No hard budget cap."}
TIPS: Include tips array (structured objects per TIPS ARRAY REQUIREMENTS) with 5–8 genuinely useful tips specific to THIS route and vehicle — not generic advice. Max 2 action-severity tips. No bare weather readings.
ROAD CONDITIONS: Include road_condition_warnings array for mountain passes, desert heat, winter weather, or construction zones actually relevant to this specific route.
ORDER: Stops must progress geographically from origin toward destination; distance and eta fields must increase logically.
ANTI-HALLUCINATION: If uncertain whether a named business exists, omit the stop rather than outputting a generic placeholder or city+category description.
${buildVerificationChecklist(ctx)}`;
}

function restaurantSchemaShape(ctx, { truck = false } = {}) {
  const truckField = truck ? ', "truck_parking": false' : '';
  const core = `"verified": true, "verification_note": "omit when verified is true", "cuisine": "Type", "rating": "4.5"`;
  if (ctx.preferences.includes("Fast food only") || ctx.preferences.includes("Sit down restaurants only")) {
    return `[{ "name": "Restaurant in stop city", ${core}, "time": "7 PM", "kidFriendly": true${truckField} }]`;
  }
  return `[{ "name": "Sit-down in stop city", ${core}, "time": "7 PM"${truckField} }, { "name": "Quick option", ${core}, "time": "flexible"${truckField} }]`;
}

function hotelSchemaShape(ctx, band = "mid") {
  return `{ "name": "From VERIFIED PLACES", "stars": 3, "price": "$120/night", "price_band": "${band}", "verified": true, "pet": false, "kidFriendly": ${ctx.youngKids} }`;
}

function buildLodgingRules(lodging) {
  const rules = {
    Budget: "Budget only — price_band budget, under $80/night.",
    "Mid-Range": "Mid-range only — price_band mid, $90–$160/night.",
    Luxury: "Luxury only — price_band luxury, $200+/night.",
    "Airbnb or Vacation Rental": "Vacation rentals and whole-home stays — not standard hotels.",
    "Camping or Outdoors": "Campgrounds and outdoor stays only.",
    "Sleeper cab — no hotel needed": "No hotel stops — truck stop parking only.",
    "Doesn't Matter": "Any suitable lodging tier in each stop city.",
  };
  return rules[lodging] || rules["Mid-Range"];
}

const TIPS_JSON_SCHEMA = `"tips": [{ "severity": "info|advisory|action", "title": "One line", "detail": "One line", "action": { "type": "reroute|depart_earlier", "label": "Short label" } }]`;

function buildJsonSchema(ctx, isSimplified) {
  if (isSimplified) {
    const continuousNote = ctx.continuousDrive
      ? `\nCONTINUOUS DRIVE: User is driving straight through with no overnight stops. Return empty stops array if present. Prioritize road_stops with category fuel and rest spaced for long-haul driving. First tip must note total drive time is ${ctx.routeDuration}.`
      : "";
    return `Return JSON:
{
  "trip_format": "simplified",
  "route_summary": "One sentence specific to this route and vehicle",
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|food|rest", "name": "From placesContext or category", "verified": true, "note": "Route-specific short note" }],
  "recommendations": [{ "name": "From placesContext", "category": "Activity|Dining|Viewpoint", "rating": "4.5", "note": "Why stop here on THIS route" }],
  ${SCHEMA_PERSONAL_TOUCHES},
  ${TIPS_JSON_SCHEMA},
  "road_condition_warnings": ["Warning specific to this route"]
}${continuousNote}`;
  }

  if (ctx.tripCategory === "commercial") {
    return `Return JSON with trip_format "multi_day":
{
  "trip_format": "multi_day",
  "truck_safe_route": true,
  "hos_compliance": "One concise paragraph (3-5 sentences): drive time, mandatory 30-min break location, overnight location, and 10-hr rest requirement for this leg.",
  "stops": [{
    "city": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "why": "HOS reason — few words", "type": "overnight|break",
    "truckStop": { "name": "From placesContext", "catScale": true, "diesel": "$3.89/gal", "amenities": "Showers · laundry · food" },
    "motels": [{ "name": "From VERIFIED PLACES", "price": "$99/night", "price_band": "mid", "verified": true, "note": "One-line parking/shuttle note" }],
    "restaurants": [{ "name": "From VERIFIED PLACES", "cuisine": "Type", "verified": true, "verification_note": "omit when verified is true", "truck_parking": false, "note": "One line" }]
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|rest", "name": "From VERIFIED PLACES", "verified": true, "truck_parking": true, "note": "One line — max 3 road_stops per leg" }],
  "safety": {
    "weighStations": [{ "state": "TX", "location": "I-40 MM 120", "note": "One line — max 3 per leg" }],
    "lowBridges": [{ "location": "City, ST", "clearance": "13'6\\"", "note": "One line" }],
    "steepGrades": [{ "location": "Pass name", "grade": "7%", "note": "One line" }],
    "hazmatRestrictions": [{ "location": "Highway", "note": "One line" }],
    "weightRestrictions": [{ "location": "Road", "note": "One line" }]
  },
  ${SCHEMA_PERSONAL_TOUCHES},
  ${TIPS_JSON_SCHEMA},
  "road_condition_warnings": ["One line each"]
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
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel", "name": "From placesContext", "verified": true, "note": "Short note" }],
  "safety": { "lowBridges": [], "steepGrades": [], "sharpCurves": [], "propaneLocations": [], "dumpStations": [], "rvParkingRestrictions": [] },
  ${SCHEMA_PERSONAL_TOUCHES},
  ${TIPS_JSON_SCHEMA},
  "road_condition_warnings": []
}`;
  }

  if (ctx.tripCategory === "water") {
    return `Return JSON:
{
  "trip_format": "simplified",
  "route_summary": "Marine route overview with disclaimer",
  "road_stops": [{ "location": "Port City, ST", "distance": "—", "eta": "—", "category": "rest", "name": "Port or marina", "note": "Marine-specific note" }],
  ${TIPS_JSON_SCHEMA},
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
  ${TIPS_JSON_SCHEMA},
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
  ${TIPS_JSON_SCHEMA},
  "road_condition_warnings": []
}`;
  }

  const restaurantShape = restaurantSchemaShape(ctx);

  return `Return JSON with trip_format "multi_day":
{
  "trip_format": "multi_day",
  "stops": [{
    "city": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "why": "5 words max", "type": "overnight",
    "hotels": [
      ${hotelSchemaShape(ctx, lodgingTierToPriceBand(ctx.lodging) || "mid")},
      { "name": "Second VERIFIED PLACES option", "stars": 3, "price": "$109/night", "price_band": "${lodgingTierToPriceBand(ctx.lodging) || "mid"}", "verified": true },
      { "name": "Third VERIFIED PLACES option", "stars": 4, "price": "$149/night", "price_band": "${lodgingTierToPriceBand(ctx.lodging) || "mid"}", "verified": true }
    ],
    "restaurants": ${restaurantShape},
    "scenicView": ${ctx.isScenic ? '"Specific overlook on this route"' : "null"}
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|food|rest", "name": "From placesContext", "verified": true, "note": "Route-specific note" }],
  ${SCHEMA_PERSONAL_TOUCHES},
  ${TIPS_JSON_SCHEMA},
  "road_condition_warnings": []
}`;
}

function buildSegmentInstructionBlock(segment, ctx) {
  return `
=== MULTI-DAY TRIP SEGMENT (${segment.segmentIndex + 1} of ${segment.totalSegments}) ===
You are planning LEG ${segment.segmentIndex + 1} of a ${segment.totalSegments}-leg multi-day journey.
Segment identifier: leg_${segment.segmentIndex + 1}_of_${segment.totalSegments}
Segment origin: ${segment.origin}
Segment destination: ${segment.destination}
Overnight stops to generate on THIS leg only: ${segment.overnightCount}
Corridor cities for this leg: ${segment.citiesAlongRoute.join(" → ")}
${segment.isFirstSegment ? "This is the FIRST leg — include departure context from the trip origin." : ""}
${segment.isLastSegment ? "This is the FINAL leg — the segment destination is the trip's final destination." : "Include exactly one overnight stop at the end of this leg."}
Distribute road_stops along THIS leg's corridor (${segment.origin} → ${segment.destination}) — not only at ${segment.destination}. Mid-leg fuel, food, and rest stops are required when leg distance exceeds 120 miles.
${ctx.tripCategory === "commercial" ? "Generate ONLY truck stops, motels (if no sleeper), road_stops, safety warnings, and HOS summary for THIS leg. Max 3 road_stops, max 3 weigh stations, max 2 motels per overnight city." : "Generate ONLY stops, hotels, restaurants, and road_stops for THIS leg."} Do NOT plan other legs of the journey.`;
}

function buildCommercialSegmentJsonSchema(ctx, segment) {
  const noSleeper = /no|without|motel/i.test(String(ctx.sleeperCab));
  return `Return JSON with trip_format "multi_day" for THIS COMMERCIAL TRUCK LEG ONLY (leg ${segment.segmentIndex + 1} of ${segment.totalSegments}):
{
  "trip_format": "multi_day",
  "truck_safe_route": true,
  "route_summary": "One sentence for THIS leg only (${segment.origin} → ${segment.destination})",
  "hos_compliance": "One concise paragraph (3-5 sentences) for THIS leg: drive time, mandatory 30-min break location, overnight location if applicable, and 10-hr rest requirement.",
  "stops": [{
    "city": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "why": "HOS reason — few words", "type": "overnight|break",
    "truckStop": { "name": "From placesContext", "catScale": true, "diesel": "$3.89/gal", "amenities": "One line" },
    ${noSleeper ? '"motels": [{ "name": "From placesContext", "price": "$99/night", "note": "One line" }, { "name": "Second option", "price": "$109/night", "note": "One line" }],' : ""}
    "restaurants": [{ "name": "From VERIFIED PLACES", "cuisine": "Type", "verified": true, "verification_note": "omit when verified is true", "truck_parking": false, "note": "One line" }]
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|rest", "name": "From VERIFIED PLACES", "verified": true, "truck_parking": true, "note": "One line — MAX 3 road_stops total on this leg" }],
  "safety": {
    "weighStations": [{ "state": "TX", "location": "Highway MM", "note": "One line — MAX 3 per leg" }],
    "lowBridges": [{ "location": "City, ST", "clearance": "13'6\\"", "note": "One line" }],
    "steepGrades": [],
    "hazmatRestrictions": [],
    "weightRestrictions": [{ "location": "Road", "note": "One line" }]
  },
  ${TIPS_JSON_SCHEMA},
  "road_condition_warnings": ["One line each if relevant to this leg"]
}
Do not repeat truck dimensions, weight, or hazmat status in output. Keep total JSON under 3500 tokens.`;
}

function buildSegmentJsonSchema(ctx, segment) {
  if (ctx.tripCategory === "commercial") {
    return buildCommercialSegmentJsonSchema(ctx, segment);
  }

  const restaurantShape = restaurantSchemaShape(ctx, { truck: ctx.tripCategory === "commercial" });

  return `Return JSON with trip_format "multi_day" for THIS SEGMENT ONLY (leg ${segment.segmentIndex + 1} of ${segment.totalSegments}):
{
  "trip_format": "multi_day",
  "route_summary": "One sentence describing THIS leg only (${segment.origin} to ${segment.destination})",
  "stops": [{
    "city": "${segment.destination.includes(",") ? segment.destination : "City, ST"}", "distance": "XXX mi", "eta": "Xh Xm", "why": "5 words max", "type": "overnight",
    "hotels": [
      { "name": "From placesContext or tier-appropriate", "stars": 3, "price": "$99/night", "price_band": "mid", "verified": true, "pet": false, "kidFriendly": ${ctx.youngKids} },
      { "name": "Second option", "stars": 3, "price": "$109/night", "price_band": "mid", "verified": true },
      { "name": "Third option", "stars": 4, "price": "$149/night", "price_band": "luxury", "verified": true }
    ],
    "restaurants": ${restaurantShape},
    "scenicView": ${ctx.isScenic ? '"Specific overlook on this leg"' : "null"}
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel|food|rest", "name": "From placesContext", "verified": true, "note": "Route-specific note for this leg" }],
  ${SCHEMA_PERSONAL_TOUCHES},
  ${TIPS_JSON_SCHEMA},
  "road_condition_warnings": []
}`;
}

function buildUserPrompt(ctx, placesContextPrompt, isSimplified, generationHints = "", extraContext = "", segment = null) {
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

  const segmentBlock = segment ? buildSegmentInstructionBlock(segment, ctx) : "";
  const jsonSchema = segment ? buildSegmentJsonSchema(ctx, segment) : buildJsonSchema(ctx, isSimplified);
  const planLine = segment
    ? `Plan THIS LEG ONLY (segment ${segment.segmentIndex + 1} of ${segment.totalSegments}). Reference segment origin (${segment.origin}), segment destination (${segment.destination}), vehicle (${ctx.vehicle}), fuel (${ctx.fuel}), and traveler profile (${ctx.travelerType}) in your route_summary, stops, and tips.`
    : `Plan this trip now. Reference the origin, destination, distance (${ctx.routeDistance}), drive time (${ctx.routeDuration}), vehicle (${ctx.vehicle}), fuel (${ctx.fuel}), and traveler profile (${ctx.travelerType}) in your route_summary, stops, and tips.`;

  return `${buildContextBlock(ctx)}

${vehicleBlock}

${buildUniversalRules(ctx, placesContextPrompt)}
${generationHints ? `\n${generationHints}\n` : ""}
${extraContext ? `\n${extraContext}\n` : ""}
${segmentBlock}

Lodging tier for this trip: ${ctx.continuousDrive ? "No overnight stay — continuous drive mode" : buildLodgingRules(ctx.lodging)}
${extras.length ? `Additional preference notes:\n${extras.map(e => `- ${e}`).join("\n")}` : ""}
${ctx.continuousDrive ? `\nCONTINUOUS DRIVE MODE: User chose to drive straight through (${ctx.routeDuration} total). No hotels, motels, or overnight city stops. Focus road_stops on fuel stations and rest areas for long-haul driving.` : ""}
${isSimplified && !segment ? `\nSHORT TRIP: Distance ${ctx.routeDistance} — use simplified single-page format; no overnight hotel stops unless essential.` : ""}

${planLine}

${jsonSchema}
${/REGENERATION DIRECTIVES/i.test(generationHints) ? '\n"changes_made": ["Bullet list of concrete changes from the previous plan — one entry per regeneration directive"]' : ""}

Remember — you are not a generic trip planner. You are a specialized expert for this exact vehicle type on this exact route. Every recommendation must prove that you understand the difference between planning a trip for an 18-wheeler versus a family minivan versus a motorcycle versus an RV. Generic suggestions are unacceptable. If you are uncertain about a specific real business at a stop location, recommend the stop city and category instead of inventing a business name.`;
}

function buildSegmentTripContext(reqBody, segment) {
  const routeInfo = {
    ...(reqBody.routeInfo || {}),
    origin: segment.origin,
    destination: segment.destination,
    citiesAlongRoute: segment.citiesAlongRoute,
  };
  return buildTripContext({
    ...reqBody,
    origin: segment.origin,
    destination: segment.destination,
    routeInfo,
  });
}

async function streamSegmentWithRetry({
  model,
  systemPrompt,
  userPrompt,
  maxTokens,
  sseWriter,
  segmentIndex,
  totalSegments,
  placesContext = null,
}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sseWriter.write("retry", { segmentIndex, attempt: attempt + 1, totalSegments });
      await new Promise(r => setTimeout(r, 1500));
    }

    const streamResult = await streamAnthropicMessages({
      model,
      systemPrompt,
      userPrompt,
      maxTokens,
      onChunk: (piece) => {
        void sseWriter.write("chunk", { text: piece, segmentIndex, totalSegments });
      },
      onProgress: (progress) => {
        void sseWriter.write("progress", { ...progress, segmentIndex, totalSegments });
      },
    });

    if (streamResult.apiError || !streamResult.response.ok) {
      const retryable = streamResult.response?.status === 429 || (streamResult.response?.status ?? 0) >= 529;
      if (retryable && attempt === 0) continue;
      throw new Error(streamResult.apiError || "API error");
    }

    try {
      const parsed = normalizeTripResponse(parseJsonFromLlm(streamResult.fullText), { placesContext });
      parsed.trip_format = "multi_day";
      if (!tripResponseHasContent(parsed) && attempt === 0) continue;
      if (!tripResponseHasContent(parsed)) {
        throw new Error("Segment returned incomplete results");
      }
      return {
        parsed,
        inputTokens: streamResult.inputTokens,
        outputTokens: streamResult.outputTokens,
      };
    } catch (parseErr) {
      if (attempt === 0) continue;
      throw parseErr;
    }
  }
  throw new Error("Segment generation failed after retries");
}

function finalizeSuccessfulGeneration({
  res,
  user,
  admin,
  parsed,
  lastInputTokens,
  lastOutputTokens,
  ctx,
  mergedAnswers,
  routeInfo,
  isSimplifiedFormat,
  maxTokensTier,
}) {
  return (async () => {
    if (user && admin && tripResponseHasContent(parsed)) {
      try {
        const validation = await validateCreditsBeforeConsume(admin, user.id, user.email);
        if (!validation.ok) {
          writePlanTripSse(res, "error", {
            error: "No Trip Generations remaining",
            code: "no_credits",
            limitReached: true,
            tier: validation.tier,
            resetDate: validation.resetDate || null,
            credits: validation,
          });
          res.end();
          return undefined;
        }
        await consumeCredit(admin, user.id, user.email);
      } catch (creditErr) {
    console.error("Credit consumption after success failed:", creditErr);
        Sentry.captureException(creditErr);
      }
      logGenerationUsage(admin, buildGenerationLogRow({
        userId: user.id,
        inputTokens: lastInputTokens,
        outputTokens: lastOutputTokens,
        ctx,
        answers: mergedAnswers,
        routeInfo,
        isSimplifiedFormat,
        maxTokensTier,
      }));
    }

    writePlanTripSse(res, "complete", parsed);
    res.end();
    return undefined;
  })();
}

export {
  buildTripContext,
  buildSystemPrompt,
  buildUserPrompt,
  buildJsonSchema,
};

export default async function handler(req, res) {
  initServerSentry();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (requireTripMappaClient(req, res)) return undefined;

  const user = await getUserFromRequest(req);
  if (requireAuthenticatedUser(user, res)) return undefined;

  const clientIp = getClientIp(req);
  const rateCheck = checkPlanTripRateLimit({ userId: user.id, ip: clientIp });
  if (!rateCheck.ok) {
    console.warn("[plan-trip] rejected:", {
      status: 429,
      reason: "rate_limited",
      limitType: rateCheck.limitType,
      userId: user.id,
      ip: clientIp,
    });
    return res.status(429).json({
      error: "Rate limit exceeded",
      code: "rate_limited",
      rateLimited: true,
      limitType: rateCheck.limitType,
      retryAfter: rateCheck.retryAfter,
    });
  }

  if (validatePlanTripPayload(req.body, res)) return undefined;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const preflight = preflightCreditFromClient(req.body.clientCreditStatus, user.id, user.email);
    if (preflight !== null && !preflight.ok) {
      return res.status(402).json({
        error: "No Trip Generations remaining",
        code: "no_credits",
        limitReached: true,
        tier: preflight.tier || preflight.status?.tier,
        resetDate: preflight.resetDate || preflight.status?.resetDate || null,
        credits: preflight.status,
      });
    }

    const status = await fetchCreditStatus(admin, user.id, user.email);
    if (!status.unlimited && status.remaining <= 0) {
      return res.status(402).json({
        error: "No Trip Generations remaining",
        code: "no_credits",
        limitReached: true,
        tier: status.tier,
        resetDate: status.resetDate || null,
        credits: status,
      });
    }
  } catch (creditErr) {
    console.error("Credit check failed:", creditErr);
    Sentry.captureException(creditErr);
    return res.status(500).json({ error: "Could not verify trip credits" });
  }

  recordPlanTripRateLimitHit({ userId: user.id, ip: clientIp });

  const {
    origin,
    destination,
    answers,
    model: requestedModel = "claude-sonnet-4-6",
    routeInfo = {},
    placesContext: rawPlacesContext = null,
    placesContextPrompt: rawPlacesContextPrompt = "",
    generationHints: rawGenerationHints = "",
    preferenceContext: rawPreferenceContext = "",
    recentTripsContext: rawRecentTripsContext = "",
    recentTripsPreferencesRollup: rawRecentTripsPreferencesRollup = "",
    userTravelPatterns: rawUserTravelPatterns = "",
    travelerDossier: rawTravelerDossier = "",
    answerConfidenceNotes: rawAnswerConfidenceNotes = "",
    gracefulDegradationNotes: rawGracefulDegradationNotes = "",
    fallbackPreferences = null,
  } = req.body;

  const model = resolveAllowedModel(requestedModel, "claude-sonnet-4-6", PLAN_TRIP_MODELS);
  const placesContextPrompt = clampString(rawPlacesContextPrompt, PROMPT_FIELD_MAX);
  const generationHints = clampString(rawGenerationHints, PROMPT_FIELD_MAX);
  const preferenceContext = clampString(rawPreferenceContext, PROMPT_FIELD_MAX);
  const recentTripsContext = clampString(rawRecentTripsContext, PROMPT_FIELD_MAX);
  const recentTripsPreferencesRollup = clampString(rawRecentTripsPreferencesRollup, PROMPT_FIELD_MAX);
  const userTravelPatterns = clampString(rawUserTravelPatterns, PROMPT_FIELD_MAX);
  const travelerDossier = clampString(rawTravelerDossier, PROMPT_FIELD_MAX);
  const answerConfidenceNotes = clampString(rawAnswerConfidenceNotes, PROMPT_FIELD_MAX);
  const gracefulDegradationNotes = clampString(rawGracefulDegradationNotes, PROMPT_FIELD_MAX);

  const mergedAnswers = fallbackPreferences
    ? { ...fallbackPreferences, ...(answers || {}) }
    : (answers || {});

  const ctx = buildTripContext(pickPlanTripContextBody(req.body, mergedAnswers));

  const effectivePlacesPrompt = buildCorridorPlacesFallback(routeInfo, placesContextPrompt);
  const corridorDegradationNote = !placesContextPrompt?.trim() && effectivePlacesPrompt
    ? "=== GRACEFUL DEGRADATION (proceed with corridor geography only) ===\nNo verified placesContext was available for this request — anchor all named stops to cities along the route corridor."
    : "";

  let prefsBlock = preferenceContext;
  if (!prefsBlock) {
    const prefs = await readUserTripPreferences(admin, user.id);
    prefsBlock = formatPreferencesForPrompt(prefs, recentTripsPreferencesRollup);
  } else if (recentTripsPreferencesRollup?.trim()) {
    prefsBlock = [prefsBlock, recentTripsPreferencesRollup.trim()].filter(Boolean).join("\n\n");
  }

  const extraContext = [prefsBlock, travelerDossier, userTravelPatterns, recentTripsContext, answerConfidenceNotes, gracefulDegradationNotes, corridorDegradationNote]
    .filter(Boolean)
    .join("\n\n");

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

  const useParallel = shouldUseParallelTripSegments({
    answers: mergedAnswers,
    routeInfo,
    isSimplifiedFormat,
    continuousDrive,
  });
  const tripSegments = useParallel
    ? buildTripSegments(routeInfo, mergedAnswers, origin, destination)
    : [];

  const segmentTokenBudget = calculateMaxTokens(
    { ...ctx, isSegment: true },
    mergedAnswers,
    routeInfo,
    false,
  );

  initPlanTripSse(res);

  if (tripSegments.length >= 2) {
    writePlanTripSse(res, "start", {
      parallel: true,
      segmentCount: tripSegments.length,
      maxTokens: segmentTokenBudget.maxTokens,
      tier: segmentTokenBudget.tier,
    });

    const sseWriter = createPlanTripSseWriter(res);
    await sseWriter.write("progress", {
      phase: "parallel_start",
      totalSegments: tripSegments.length,
      completedSegments: 0,
      segmentIndex: 0,
      message: `Planning leg 1 of ${tripSegments.length}…`,
    });

    try {
      const segmentPromises = tripSegments.map((segment) => {
        const segmentCtx = buildSegmentTripContext(pickPlanTripContextBody(req.body, mergedAnswers), segment);
        const segmentPrompt = buildUserPrompt(
          segmentCtx,
          effectivePlacesPrompt,
          false,
          generationHints,
          extraContext,
          segment,
        );

        return streamSegmentWithRetry({
          model,
          systemPrompt: buildSystemPrompt(segmentCtx),
          userPrompt: segmentPrompt,
          maxTokens: segmentTokenBudget.maxTokens,
          sseWriter,
          segmentIndex: segment.segmentIndex,
          totalSegments: segment.totalSegments,
          placesContext: rawPlacesContext,
        }).then(async (result) => {
          await sseWriter.write("segment_complete", {
            segmentIndex: segment.segmentIndex,
            totalSegments: segment.totalSegments,
            origin: segment.origin,
            destination: segment.destination,
            stops: result.parsed.stops || [],
            road_stops: result.parsed.road_stops || [],
          });
          return result;
        });
      });

      const segmentResults = await Promise.all(segmentPromises);
      await sseWriter.wait();

      const stitched = stitchTripSegments(segmentResults.map(r => r.parsed));
      let parsed;
      try {
        parsed = normalizeTripResponse(stitched, { placesContext: rawPlacesContext });
      } catch (stitchErr) {
        Sentry.captureException(stitchErr);
        writePlanTripSse(res, "error", {
          error: "Trip planner returned invalid data",
          code: "parse_failed",
          reason: stitchErr?.message || "stitch_failed",
        });
        res.end();
        return undefined;
      }

      if (!tripResponseHasContent(parsed)) {
        writePlanTripSse(res, "error", {
          error: "Trip planner returned incomplete results",
          code: "incomplete_response",
        });
        res.end();
        return undefined;
      }

      const lastInputTokens = segmentResults.reduce((sum, r) => sum + (r.inputTokens || 0), 0);
      const lastOutputTokens = segmentResults.reduce((sum, r) => sum + (r.outputTokens || 0), 0);

      return finalizeSuccessfulGeneration({
        res,
        user,
        admin,
        parsed,
        lastInputTokens,
        lastOutputTokens,
        ctx,
        mergedAnswers,
        routeInfo,
        isSimplifiedFormat: false,
        maxTokensTier: segmentTokenBudget.tier,
      });
    } catch (err) {
      console.error("Parallel plan trip error:", err);
      Sentry.captureException(err);
      await sseWriter.wait();
      writePlanTripSse(res, "error", {
        error: err?.message || "Failed to generate trip plan",
        code: "api_error",
      });
      res.end();
      return undefined;
    }
  }

  const userPrompt = buildUserPrompt(ctx, effectivePlacesPrompt, isSimplifiedFormat, generationHints, extraContext);
  const { maxTokens, tier: maxTokensTier } = calculateMaxTokens(ctx, mergedAnswers, routeInfo, isSimplifiedFormat);
  logPlanTripDev({ event: "max_tokens_tier", maxTokens, tier: maxTokensTier });

  writePlanTripSse(res, "start", { maxTokens, tier: maxTokensTier });

  try {
    let parsed = null;
    let lastInputTokens = 0;
    let lastOutputTokens = 0;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        writePlanTripSse(res, "retry", { attempt: attempt + 1 });
        await new Promise(r => setTimeout(r, 1500));
      }

      const streamResult = await streamAnthropicMessages({
        model,
        systemPrompt: buildSystemPrompt(ctx),
        userPrompt,
        maxTokens,
        onChunk: (piece) => {
          writePlanTripSse(res, "chunk", { text: piece });
        },
        onProgress: (progress) => {
          writePlanTripSse(res, "progress", progress);
        },
      });

      lastInputTokens = streamResult.inputTokens;
      lastOutputTokens = streamResult.outputTokens;

      if (streamResult.apiError || !streamResult.response.ok) {
        const retryable = streamResult.response?.status === 429 || (streamResult.response?.status ?? 0) >= 529;
        if (retryable && attempt === 0) continue;
        writePlanTripSse(res, "error", {
          error: streamResult.apiError || "API error",
          code: "api_error",
        });
        res.end();
        return undefined;
      }

      const text = streamResult.fullText;
      try {
        parsed = normalizeTripResponse(parseJsonFromLlm(text), { placesContext: rawPlacesContext });
      } catch (parseErr) {
        if (attempt === 0) continue;
        Sentry.captureException(parseErr);
        writePlanTripSse(res, "error", {
          error: "Trip planner returned invalid data",
          code: "parse_failed",
          reason: parseErr?.message || "parse_failed",
        });
        res.end();
        return undefined;
      }

      parsed.trip_format = isSimplifiedFormat ? "simplified" : parsed.trip_format || "multi_day";

      if (!tripResponseHasContent(parsed) && attempt === 0) continue;
      if (!tripResponseHasContent(parsed)) {
        writePlanTripSse(res, "error", {
          error: "Trip planner returned incomplete results",
          code: "incomplete_response",
        });
        res.end();
        return undefined;
      }
      break;
    }

    return finalizeSuccessfulGeneration({
      res,
      user,
      admin,
      parsed,
      lastInputTokens,
      lastOutputTokens,
      ctx,
      mergedAnswers,
      routeInfo,
      isSimplifiedFormat,
      maxTokensTier,
    });
  } catch (err) {
    console.error("Plan trip error:", err);
    Sentry.captureException(err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Failed to generate trip plan" });
    }
    writePlanTripSse(res, "error", {
      error: "Failed to generate trip plan",
      code: "server_error",
      reason: err?.message || "unknown",
    });
    res.end();
    return undefined;
  }
}
