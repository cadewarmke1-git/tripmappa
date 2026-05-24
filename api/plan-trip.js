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
- Truck height: ${answers?.truck_height || "unknown"} · Weight: ${answers?.truck_weight || "unknown"} · Hazmat: ${answers?.truck_hazmat || "No"}
- Lodging preference: ${answers?.lodging || "Truck stop"}
- Include truck stops (Pilot/Flying J/Love's/TA) with parking, showers, scales, DEF
- Weigh station locations with operating hours
- HOS compliance: 11-hour daily driving limit, 30-min break every 8 hours
- Flag low bridges, steep grades over 6%, hazmat tunnels if hazmat Yes
- Fuel stops with diesel prices and amenities between overnight stops`
    : "";

  const rvBlock = isRv
    ? `
- RV/Camper: ${vehicle}
- Height: ${answers?.rv_height || "unknown"} · Weight: ${answers?.rv_weight || "unknown"} · Towing vehicle: ${answers?.rv_towing || "No"}
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

  const systemPrompt = `You are TripMappa, a concise AI travel planner.
Respond with a JSON object only — no markdown, no extra text.
Keep all text extremely short and scannable.`;

  const userPrompt = isTrucker
    ? `Plan a commercial truck route from ${origin} to ${destination}.
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
    ? `Plan an RV-safe route from ${origin} to ${destination}.
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
    ? `Plan a flight trip from ${origin} to ${destination}.${prefsBlock}

Return JSON:
{
  "road_stops": [{ "location": "Airport area", "distance": "—", "eta": "—", "category": "rest", "name": "Airport transport", "note": "Ground transport tip" }],
  "tips": ["Flight tip 1", "Airport tip 2"]
}`
    : needsOvernight
    ? `Plan a ${tripType.toLowerCase()} from ${origin} to ${destination}.
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
    : `Plan road stops for a ${tripType.toLowerCase()} from ${origin} to ${destination}.
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
