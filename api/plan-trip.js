/** Active trip-generation endpoint (Anthropic Sonnet). Called via src/lib/apiClient.js only. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { origin, destination, answers, routeInfo, legs, model = "claude-sonnet-4-20250514" } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  const tripType = answers?.trip_type || "Road trip";
  const vehicle = answers?.vehicle || "Car";
  const preferences = Array.isArray(answers?.preferences) ? answers.preferences : [];
  const fuel = answers?.fuel || (preferences.includes("EV charging stops") ? "Electric (EV)" : ["Semi Truck (18-wheeler)", "Box Truck", "Flatbed", "Tanker"].includes(vehicle) ? "Diesel" : "Gasoline");
  const isTrucker = ["Semi Truck (18-wheeler)", "Box Truck", "Flatbed", "Tanker"].includes(vehicle) || tripType === "Work or Delivery run";
  const isRv = ["RV", "Camper Van"].includes(vehicle);
  const hasKids = answers?.travelers === "Family with kids";
  const kidsAges = answers?.kids_ages || "";
  const isScenic = preferences.includes("Scenic route") || routeInfo?.scenic === true;
  const needsOvernight = !["Day trip", "Driving home"].includes(tripType) && answers?.lodging !== "No overnight stay" && answers?.lodging !== "Sleeper cab — no hotel needed";
  const hasLegs = Array.isArray(legs) && legs.length > 0;

  const prefsBlock = preferences.length ? `\n- Preferences: ${preferences.join(", ")}` : "";

  const truckBlock = isTrucker
    ? `
- Commercial vehicle: ${vehicle}
- Assumed dimensions: height ${answers?.truck_height || "13'6\""} · weight ${answers?.truck_weight || "80,000 lbs"} · Hazmat: ${answers?.truck_hazmat || "No"} · Fuel: Diesel
- Hauling type: ${answers?.hauling_type || "General Freight"}
- Sleeper cab: ${answers?.sleeper_cab || "Unknown"}${answers?.lodging ? ` · Lodging plan: ${answers.lodging}` : ""}
- Route restrictions: ${Array.isArray(answers?.route_restrictions) && answers.route_restrictions.length ? answers.route_restrictions.join(", ") : "None"}
- Preferred truck stop brand: ${answers?.truck_stop_brand || answers?.truck_stop_preference || "No preference"}
- HOS compliance REQUIRED: 11-hour daily driving limit, mandatory 30-minute break every 8 hours, minimum 10-hour rest at each overnight stop
- Prioritize ${answers?.truck_stop_brand && answers.truck_stop_brand !== "No preference" ? answers.truck_stop_brand : "Pilot/Flying J, Love's, Petro, or TA"} truck stops when brand preference set
- Use hauling type to tailor stops (${answers?.hauling_type || "General Freight"} — e.g. reefer amenities for refrigerated, flatbed parking for flatbed)
- If sleeper cab: recommend truck stop parking only; if no sleeper: include motel rooms near truck stops
- Apply route restrictions to avoid tolls, low bridges, or specified states as listed
- Include truck stops with parking spaces, showers, laundry, diesel prices, and CAT scales
- Weigh station locations with operating hours
- Flag low bridges under assumed height, steep grades over 6%
- Fuel stops with diesel prices and DEF between overnight stops`
    : "";

  const rvBlock = isRv
    ? `
- RV/Camper: ${vehicle}
- Height: ${answers?.rv_height || "11'0\""} · Weight: ${answers?.rv_weight || "12,000 lbs"} · Towing: ${answers?.rv_towing || "No"} (assumed standard RV dimensions)
- Flag low bridges under 14ft clearance, steep grades over 8%, sharp switchbacks
- Include KOA, Good Sam, Thousand Trails RV parks with full hookups, amp options, pull-through sites
- Include state/national forest campgrounds with max RV length and hookup info
- Include Walmart/Cracker Barrel free overnight parking options
- High clearance fuel stops (truck stops and RV-friendly stations), DEF for diesel RVs
- Propane refill and dump station locations between stops${answers?.rv_towing === "Yes" ? "\n- Towing: extra length restrictions, unhitch zones, oversized parking, state towing speed limits" : ""}`
    : "";

  const kidsBlock = hasKids
    ? `
- Travelers: Family with kids (${kidsAges})
- Rest stops every ~2 hours; kid-friendly hotels (pools, cribs, adjoining rooms)
- Kid-friendly restaurants with kids menus and high chairs
- Tip: "Rest stops suggested every 2 hours for young travelers"${kidsAges === "Toddlers" || kidsAges === "Mix of ages" ? '\n- Diaper changing stations at rest stops' : ""}`
    : "";

  const scenicBlock = isScenic
    ? "\n- Scenic route: favor backroads, scenic overlooks, photo spots near each stop"
    : "";

  const petBlock = preferences.includes("Pet-friendly stops")
    ? "\n- Pet-friendly: flag pet-friendly hotels, pet relief areas at rest stops, note national parks allowing pets on trails"
    : "";

  const routeOrigin = routeInfo?.origin || origin;
  const routeDestination = routeInfo?.destination || destination;
  const citiesAlongRoute = Array.isArray(routeInfo?.citiesAlongRoute) ? routeInfo.citiesAlongRoute : [];
  const legCities = hasLegs
    ? legs.map(leg => leg.end || leg.to || leg.destination || leg.city).filter(Boolean)
    : [];

  const routeConstraintBlock = `
CRITICAL — ROUTE LOCATION RULES (must follow exactly):
- Origin: ${routeOrigin}
- Destination: ${routeDestination}
${routeInfo?.start ? `- Route starts near: ${routeInfo.start}` : ""}
${routeInfo?.end ? `- Route ends near: ${routeInfo.end}` : ""}
${routeInfo?.distance ? `- Total distance: ${routeInfo.distance}` : ""}
${routeInfo?.duration ? `- Drive time: ${routeInfo.duration}` : ""}
${citiesAlongRoute.length ? `- Cities/towns along the driving route (use ONLY these or other real towns between origin and destination): ${citiesAlongRoute.join(" → ")}` : ""}
${legCities.length ? `- Leg stop cities: ${legCities.join(" → ")}` : ""}
Every "city", "location", hotel, restaurant, fuel stop, truck stop, and road_stop MUST be a real place in the correct city and state along the actual route from ${routeOrigin} to ${routeDestination}.
Do NOT invent cities from other regions. Do NOT use placeholder examples (e.g. Amarillo, Albuquerque) unless they are genuinely on this route.`;

  const systemPrompt = `You are TripMappa, a concise AI travel planner.
Respond with a JSON object only — no markdown, no extra text.
Keep all text extremely short and scannable.
All stop and hotel cities MUST match the user's actual route — never use unrelated cities.`;

  const userPrompt = isTrucker
    ? `${routeConstraintBlock}

Plan a commercial truck route from ${routeOrigin} to ${routeDestination}.
- Trip type: ${tripType}
- Distance: ${routeInfo?.distance || "unknown"}
- Drive time: ${routeInfo?.duration || "unknown"}
- Fuel: ${fuel}${truckBlock}${prefsBlock}

Return JSON:
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
- Distance: ${routeInfo?.distance || "unknown"}
- Drive time: ${routeInfo?.duration || "unknown"}
- Fuel: ${fuel} · ~9 MPG average${rvBlock}${kidsBlock}${scenicBlock}${petBlock}${prefsBlock}

Return JSON:
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
    : tripType === "Flying" || vehicle === "Plane"
    ? `${routeConstraintBlock}

Plan a flight trip from ${routeOrigin} to ${routeDestination}.${prefsBlock}

Return JSON:
{
  "road_stops": [{ "location": "Airport area", "distance": "—", "eta": "—", "category": "rest", "name": "Airport transport", "note": "Ground transport tip" }],
  "tips": ["Flight tip 1", "Airport tip 2"]
}`
    : needsOvernight
    ? `${routeConstraintBlock}

Plan a ${tripType.toLowerCase()} from ${routeOrigin} to ${routeDestination}.
- Distance: ${routeInfo?.distance || "unknown"}
- Drive time: ${routeInfo?.duration || "unknown"}
- Vehicle: ${vehicle} · Fuel: ${fuel}
- Travelers: ${answers?.travelers || "Solo"}
- Lodging: ${answers?.lodging || "Mid-range hotel"}${kidsBlock}${scenicBlock}${petBlock}${prefsBlock}

Return JSON:
{
  "stops": [{
    "city": "City, State", "distance": "XXX miles", "eta": "Xh Xm", "why": "5 words max", "type": "overnight",
    "hotels": [{ "name": "Hotel", "stars": 4, "price": "$XXX/night", "pet": true, "kidFriendly": true }],
    "restaurants": ${preferences.includes("Restaurant recommendations") ? `[{ "name": "Restaurant", "cuisine": "Type", "rating": "4.5", "time": "7 PM", "kidFriendly": true }]` : "[]"},
    "scenicView": ${isScenic ? '"Scenic viewpoint nearby"' : "null"}
  }],
  "road_stops": [{ "location": "City, ST", "distance": "XXX mi", "eta": "Xh Xm", "category": "rest", "name": "Rest stop", "note": "Short note" }],
  "tips": ["Driving tip 1", "Driving tip 2"]
}`
    : `${routeConstraintBlock}

Plan road stops for a ${tripType.toLowerCase()} from ${routeOrigin} to ${routeDestination}.
- Vehicle: ${vehicle} · Fuel: ${fuel}${kidsBlock}${scenicBlock}${petBlock}${prefsBlock}

Return JSON:
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
