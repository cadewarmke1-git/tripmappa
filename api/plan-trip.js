/** Active trip-generation endpoint (Anthropic Sonnet). Called via src/lib/apiClient.js only. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { origin, destination, answers, routeInfo, legs, model = "claude-sonnet-4-20250514", placesContextPrompt = "" } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  function resolveEffectiveVehicle(a) {
    const v = a?.vehicle || "Car";
    if (v === "Multi-Vehicle Trip" && a?.primary_vehicle) {
      if (a.primary_vehicle === "Truck") return "Semi Truck (18-wheeler)";
      return a.primary_vehicle;
    }
    return a?.effective_vehicle || v;
  }

  const TRUCK_TYPES = ["Semi Truck (18-wheeler)", "Box Truck", "Flatbed", "Tanker"];
  const RV_TYPES = ["RV", "Camper Van"];
  const WATER_TYPES = ["Boat", "Ferry"];

  const tripType = answers?.trip_type || "Road trip";
  const rawVehicle = answers?.vehicle || "Car";
  const vehicle = resolveEffectiveVehicle(answers);
  const preferences = Array.isArray(answers?.preferences) ? answers.preferences : [];
  const routeRestrictions = Array.isArray(answers?.route_restrictions) ? answers.route_restrictions : [];
  const coordinationNeeds = Array.isArray(answers?.coordination_needs) ? answers.coordination_needs : [];
  const fuel = answers?.fuel || (preferences.includes("EV charging stops") ? "Electric (EV)" : TRUCK_TYPES.includes(vehicle) ? "Diesel" : "Gasoline");
  const isTrucker = TRUCK_TYPES.includes(vehicle) || tripType === "Work or Delivery run";
  const isRv = RV_TYPES.includes(vehicle);
  const isWater = WATER_TYPES.includes(vehicle) || WATER_TYPES.includes(rawVehicle);
  const isPlane = vehicle === "Plane" || rawVehicle === "Plane";
  const isMultiVehicle = rawVehicle === "Multi-Vehicle Trip";
  const partySize = (() => {
    const t = answers?.travelers;
    if (t === "1") return 1;
    if (t === "2") return 2;
    if (t === "3 to 5") return 4;
    if (t === "6 or more") return 6;
    return null;
  })();
  const isScenic = preferences.includes("Scenic route") || routeInfo?.scenic === true;
  const needsOvernight = !["Day trip", "Driving home"].includes(tripType) && answers?.lodging !== "No overnight stay" && answers?.lodging !== "Sleeper cab — no hotel needed";
  const hasLegs = Array.isArray(legs) && legs.length > 0;

  const lodgingPref = answers?.lodging || "Mid-Range";
  const lodgingPreferenceBlock = (() => {
    const base = `- Lodging preference: ${lodgingPref}
- CRITICAL: Only suggest overnight stop cities along the route corridor where lodging matching this preference is realistically available. If a corridor city lacks matching options, suggest the nearest alternative city on the route that does.`;
    const rules = {
      Budget: "Budget — 1-2 star hotels and motels under $80/night only. Prioritize cheapest options.",
      "Mid-Range": "Mid-Range — 3-star hotels between $80 and $150/night. Prioritize solid 3-star properties.",
      Luxury: "Luxury — 4-5 star hotels over $150/night only. Require 4+ stars and 4.5+ guest ratings.",
      "Airbnb or Vacation Rental": "Airbnb or vacation rentals — whole-home or apartment stays, not standard hotels.",
      "Camping or Outdoors": "Camping or outdoors — campgrounds, state parks, and outdoor stays only; no hotels.",
      "Doesn't Matter": "No lodging type restriction — any suitable overnight option in each stop city.",
    };
    return `${base}\n- ${rules[lodgingPref] || rules["Mid-Range"]}`;
  })();

  const partyBlock = partySize
    ? `
- Party size: ${partySize} travelers
- Size hotel rooms and restaurant table recommendations for this party count
- Use neutral party-size language only — never describe anyone as traveling alone`
    : "";

  const prefsBlock = preferences.length ? `\n- Preferences: ${preferences.join(", ")}` : "";
  const restrictionsBlock = routeRestrictions.length ? `\n- Route restrictions: ${routeRestrictions.join(", ")}` : "";

  const multiBlock = isMultiVehicle
    ? `
- Multi-vehicle trip — vehicles on trip: ${(answers?.multi_vehicles || []).join(", ") || "Not specified"}
- Primary vehicle (drives routing): ${answers?.primary_vehicle || "Not specified"}
- Coordination needs: ${coordinationNeeds.length ? coordinationNeeds.join(", ") : "None specified"}`
    : "";

  const truckBlock = isTrucker
    ? `
- Commercial vehicle: ${vehicle}${rawVehicle !== vehicle ? ` (selected trip type: ${rawVehicle})` : ""}
- Assumed dimensions: height ${answers?.truck_height || "13'6\""} · weight ${answers?.truck_weight || "80,000 lbs"} · Hazmat: ${answers?.truck_hazmat || "No"} · Fuel: Diesel
- Hauling type: ${answers?.hauling_type || "General freight"}
- Sleeper cab: ${answers?.sleeper_cab || "Unknown"}${answers?.lodging ? ` · Lodging plan: ${answers.lodging}` : ""}
- Preferred truck stop brand: ${answers?.truck_stop_brand || answers?.truck_stop_preference || "No preference"}
- HOS compliance REQUIRED: ${answers?.hos_compliance !== false ? "Yes — 11-hour daily driving limit, mandatory 30-minute break every 8 hours, minimum 10-hour rest at each overnight stop" : "Yes"}
- Prioritize ${answers?.truck_stop_brand && answers.truck_stop_brand !== "No preference" ? answers.truck_stop_brand : "Pilot/Flying J, Love's, Petro, or TA"} truck stops when brand preference set
- Use hauling type to tailor stops (${answers?.hauling_type || "General freight"} — e.g. reefer amenities for refrigerated, flatbed parking for flatbed)
- If sleeper cab: recommend truck stop parking only; if no sleeper: include motel rooms near truck stops
- Apply route restrictions to avoid tolls or specified states as listed
- Include truck stops with parking spaces, showers, laundry, diesel prices, and CAT scales
- Weigh station locations with operating hours
- Flag low bridges under assumed height, steep grades over 6%
- Fuel stops with diesel prices and DEF between overnight stops${restrictionsBlock}`
    : "";

  const rvBlock = isRv
    ? `
- RV/Camper: ${vehicle}
- Lodging: ${answers?.lodging || "RV parks and campgrounds"} (auto-route to RV parks — no hotels)
- Height: ${answers?.rv_height || "11'0\""} · Weight: ${answers?.rv_weight || "12,000 lbs"} · Towing: ${answers?.rv_towing || "No"} (assumed standard RV dimensions)
- Flag low bridges under 14ft clearance, steep grades over 8%, sharp switchbacks
- Include KOA, Good Sam, Thousand Trails RV parks with full hookups, amp options, pull-through sites
- Include state/national forest campgrounds with max RV length and hookup info
- Include Walmart/Cracker Barrel free overnight parking options
- High clearance fuel stops (truck stops and RV-friendly stations), DEF for diesel RVs
- Propane refill and dump station locations between stops${answers?.rv_towing === "Yes" ? "\n- Towing: extra length restrictions, unhitch zones, oversized parking, state towing speed limits" : ""}`
    : "";

  const kidsBlock = "";

  const scenicBlock = isScenic
    ? "\n- Scenic route: favor backroads, scenic overlooks, photo spots near each stop"
    : "";

  const dietary = Array.isArray(answers?.dietary) ? answers.dietary : [];
  const accessibility = Array.isArray(answers?.accessibility) ? answers.accessibility : [];
  const stopsInterests = Array.isArray(answers?.stops_interests) ? answers.stops_interests : [];
  const tripBudget = answers?.trip_budget;
  const towing = answers?.towing;
  const loyalty = answers?.loyalty_program;

  const accommodationsBlock = `
HUMAN POSSIBILITY ACCOMMODATIONS (must follow exactly):
${dietary.length ? `- Dietary needs: ${dietary.join(", ")}${answers?.food_allergies ? ` · Allergies: ${answers.food_allergies}` : ""}` : ""}
${accessibility.length ? `- Accessibility: ${accessibility.join(", ")}` : ""}
${stopsInterests.length ? `- Stops & interests: ${stopsInterests.join(", ")}` : ""}
${tripBudget && tripBudget !== "No budget limit" ? `- Total trip budget cap: ${tripBudget} — NEVER exceed this across all lodging and stops combined` : ""}
${towing && towing !== "No" ? `- Towing: ${towing} — recommend stops with trailer parking; avoid low clearance and sharp turns` : ""}
${loyalty && loyalty !== "No preference" ? `- Hotel loyalty: prioritize ${loyalty} branded properties at overnight stops` : ""}
${stopsInterests.some(i => /music|comedy|drive-in|antique/i.test(i)) ? "- Suggest evening activities matching entertainment interests at each overnight stop with brief descriptions" : ""}
${stopsInterests.includes("Remote work — WiFi cafés") ? "- Prioritize restaurants and cafés with strong WiFi at stops" : ""}
- For any driving segment between 10 PM and 6 AM: suggest well-lit 24-hour staffed facilities only
- Use only real place names when provided in placesContext; do not invent businesses`;

  const petBlock = preferences.includes("Pet friendly")
    ? "\n- Pet-friendly: flag pet-friendly hotels, pet relief areas at rest stops, note national parks allowing pets on trails"
    : "";

  const kidStopsBlock = preferences.includes("Kid friendly stops")
    ? "\n- Kid-friendly stops: playgrounds, family restrooms, quick meal options for kids"
    : "";

  const evBlock = preferences.includes("EV charging stops")
    ? "\n- EV charging: prioritize charging stations along route with fast-charger availability"
    : "";

  const foodBlock = preferences.includes("Fast food only")
    ? "\n- Dining: fast food and quick-service only at stops"
    : preferences.includes("Sit down restaurants only")
    ? "\n- Dining: sit-down restaurants only at stops"
    : "";

  const routeOrigin = routeInfo?.origin || origin;
  const routeDestination = routeInfo?.destination || destination;
  const citiesAlongRoute = Array.isArray(routeInfo?.citiesAlongRoute) ? routeInfo.citiesAlongRoute : [];
  const legCities = hasLegs
    ? legs.map(leg => leg.end || leg.to || leg.destination || leg.city).filter(Boolean)
    : [];

  const routeDistance = routeInfo?.distance || "unknown";
  const routeDuration = routeInfo?.duration || "unknown";

  const routeInfoBlock = `
FULL ROUTE INFORMATION (use for all stop placement decisions):
- Origin: ${routeOrigin}
- Destination: ${routeDestination}
- Total distance: ${routeDistance}
- Estimated drive time: ${routeDuration}
${routeInfo?.start ? `- Route starts near: ${routeInfo.start}` : ""}
${routeInfo?.end ? `- Route ends near: ${routeInfo.end}` : ""}
${citiesAlongRoute.length ? `- Known cities/towns along the driving corridor: ${citiesAlongRoute.join(" → ")}` : ""}
${legCities.length ? `- Leg stop cities: ${legCities.join(" → ")}` : ""}`;

  const routeConstraintBlock = `${routeInfoBlock}${placesContextPrompt || ""}

CRITICAL — OVERNIGHT STOP CITY RULES (must follow exactly):
- Every overnight stop "city" field MUST be a real US city or town located along the actual driving corridor between ${routeOrigin} and ${routeDestination}.
- NEVER suggest a stop city that requires a significant detour from the main route — stays must be on or within a few miles of the driving path.
- Space overnight stops evenly based on total drive time (${routeDuration}) so no single driving segment exceeds 8 hours.
- ALWAYS format each stop city as "City, State" (full city name and two-letter state abbreviation) — this is displayed as the location header above hotel/lodging cards.
- Do NOT invent cities from other regions. Do NOT reuse example cities (e.g. Amarillo, Albuquerque) unless they genuinely lie on this specific route.
- Every "location" in road_stops, hotels, restaurants, fuel stops, and truck stops MUST be in a city that lies on this same corridor.
- Order stops geographically from origin toward destination; "distance" and "eta" must progress logically along the route.`;

  const systemPrompt = `You are TripMappa, a concise AI travel planner.
Respond with a JSON object only — no markdown, no extra text.
Keep all text extremely short and scannable.

STRICT ROUTING RULES — never violate these:
1. Every overnight stop city must be a real US city located along the actual driving corridor between the trip origin and destination.
2. Never suggest a stop city that requires a significant detour from the route.
3. Space overnight stops evenly based on drive time so no single driving segment exceeds 8 hours.
4. Always return each stop city as "City, State" (full name and state abbreviation) for display above hotel/lodging cards.
5. All hotels, restaurants, fuel stops, truck stops, and road_stops must be in cities on the same corridor — never unrelated regions.
6. Never exceed the user's stated total trip budget across lodging and stops.
7. Prioritize hotel loyalty program brand when preference is stated.
8. Always suggest well-lit 24-hour facilities for segments between 10 PM and 6 AM.`;

  const userPrompt = isTrucker
    ? `${routeConstraintBlock}

Plan a commercial truck route from ${routeOrigin} to ${routeDestination}.
- Trip type: ${tripType}
- Total distance: ${routeDistance}
- Estimated drive time: ${routeDuration}
- Fuel: ${fuel}${truckBlock}${multiBlock}${accommodationsBlock}${prefsBlock}

Return JSON (each stop "city" MUST be "City, State" on the driving corridor):
{
  "stops": [{
    "city": "City, State", "distance": "XXX mi", "eta": "Xh Xm", "why": "5 words max", "type": "overnight",
    "truckStop": { "name": "Pilot Flying J", "spaces": 120, "showers": true, "laundry": true, "restaurant": true, "diesel": "$3.89/gal", "hours": "24/7" },
    "motel": { "name": "Budget Inn", "price": "$69/night", "distance": "0.5 mi", "parking": "Large rig parking" },
    "restArea": { "name": "I-40 Rest Area", "spaces": 24, "distance": "10 mi", "amenities": "Restrooms · vending" },
    "fuelStops": [{ "name": "Love's", "location": "City, ST", "distance": "XXX mi", "diesel": "$3.89/gal", "amenities": "Showers · CAT scales · DEF" }]
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel", "name": "Pilot Flying J", "note": "Diesel $3.89 · showers · scales" }],
  "safety": { "weighStations": 3, "lowBridges": [], "steepGrades": [] },
  "tips": ["HOS Compliant Route tip", "Truck parking tip"]
}`
    : isRv
    ? `${routeConstraintBlock}

Plan an RV-safe route from ${routeOrigin} to ${routeDestination}.
- Trip type: ${tripType}
- Total distance: ${routeDistance}
- Estimated drive time: ${routeDuration}
- Fuel: ${fuel} · ~9 MPG average${rvBlock}${partyBlock}${scenicBlock}${accommodationsBlock}${petBlock}${evBlock}${foodBlock}${multiBlock}${prefsBlock}

Return JSON (each stop "city" MUST be "City, State" on the driving corridor):
{
  "stops": [{
    "city": "City, State", "distance": "XXX mi", "eta": "Xh Xm", "why": "5 words max", "type": "overnight",
    "rvPark": { "name": "KOA Journey", "fullHookups": 40, "amp30": true, "amp50": true, "pullThrough": 25, "backIn": 15, "maxLength": "45 ft", "amenities": "WiFi · pool · laundry · dump · dog park", "rate": "$55/night" },
    "campground": { "name": "State Park Campground", "maxLength": "40 ft", "hookups": "Water & electric", "distanceFromHighway": "8 mi", "reservation": "Reservation required" },
    "freeParking": { "name": "Walmart Supercenter", "type": "Walmart", "note": "Free overnight parking — confirm with store before arrival", "distance": "2 mi from route" },
    "fuelStops": [{ "name": "Love's Travel Stop", "location": "City, ST", "distance": "XXX mi", "fuel": "Gasoline & diesel", "highClearance": true, "def": true, "rvFriendly": true, "amenities": "High clearance · RV lanes · DEF" }]
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel", "name": "Love's", "note": "High clearance · RV-friendly · DEF" }],
  "safety": { "lowBridges": [], "steepGrades": [], "sharpCurves": [], "propaneLocations": [], "dumpStations": [] },
  "tips": ["RV Safe Route tip", "Dump station tip"]
}`
    : tripType === "Flying" || isPlane
    ? `${routeConstraintBlock}

Plan a flight trip from ${routeOrigin} to ${routeDestination}.
Showing airport transport, layover recommendations, and destination activity suggestions only.${multiBlock}${prefsBlock}

Return JSON:
{
  "road_stops": [{ "location": "Airport area", "distance": "—", "eta": "—", "category": "rest", "name": "Airport transport", "note": "Ground transport tip" }],
  "tips": ["Flight tip 1", "Airport tip 2"]
}`
    : isWater || tripType === "Ferry or Cruise"
    ? `${routeConstraintBlock}

Plan marine travel from ${routeOrigin} to ${routeDestination}.
Marine routing is approximate — show departure and arrival port recommendations only.${multiBlock}${prefsBlock}

Return JSON:
{
  "road_stops": [{ "location": "Departure port", "distance": "—", "eta": "—", "category": "rest", "name": "Port recommendation", "note": "Marine routing approximate" }],
  "tips": ["Marine routing tip", "Port arrival tip"]
}`
    : needsOvernight
    ? `${routeConstraintBlock}

Plan a ${tripType.toLowerCase()} from ${routeOrigin} to ${routeDestination}.
- Total distance: ${routeDistance}
- Estimated drive time: ${routeDuration}
- Vehicle: ${vehicle}${rawVehicle !== vehicle ? ` (trip: ${rawVehicle})` : ""} · Fuel: ${fuel}
${partyBlock}
${lodgingPreferenceBlock}${scenicBlock}${accommodationsBlock}${petBlock}${evBlock}${foodBlock}${multiBlock}${prefsBlock}

Return JSON (each stop "city" MUST be "City, State" on the driving corridor; space stops so no segment exceeds 8 hours driving):
{
  "stops": [{
    "city": "City, State", "distance": "XXX miles", "eta": "Xh Xm", "why": "5 words max", "type": "overnight",
    "hotels": [{ "name": "Hotel", "stars": 4, "price": "$XXX/night", "pet": true, "kidFriendly": true }],
    "restaurants": ${preferences.includes("Sit down restaurants only") || preferences.includes("Fast food only") ? `[{ "name": "Restaurant", "cuisine": "Type", "rating": "4.5", "time": "7 PM", "kidFriendly": true }]` : "[]"},
    "scenicView": ${isScenic ? '"Scenic viewpoint nearby"' : "null"}
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "rest", "name": "Rest stop", "note": "Short note" }],
  "tips": ["Driving tip 1", "Driving tip 2"]
}`
    : `${routeConstraintBlock}

Plan road stops for a ${tripType.toLowerCase()} from ${routeOrigin} to ${routeDestination}.
- Total distance: ${routeDistance}
- Estimated drive time: ${routeDuration}
- Vehicle: ${vehicle}${rawVehicle !== vehicle ? ` (trip: ${rawVehicle})` : ""} · Fuel: ${fuel}
${partyBlock}${scenicBlock}${accommodationsBlock}${petBlock}${evBlock}${foodBlock}${multiBlock}${prefsBlock}

Return JSON (all locations MUST be "City, State" on the driving corridor):
{
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "fuel", "name": "Stop name", "note": "Short note" }],
  "tips": ["Driving tip 1"]
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: isTrucker || isRv ? 2000 : 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "API error" });
    }

    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Plan trip error:", err);
    return res.status(500).json({ error: "Failed to generate trip plan" });
  }
}
