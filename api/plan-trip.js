export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { origin, destination, answers, routeInfo } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  const tripType = answers?.trip_type || "Road trip";
  const needsOvernight = (answers?.overnight === "Yes" || tripType === "Road trip") && answers?.overnight !== "No";
  const isEV = answers?.fuel === "Electric (EV)";

  const systemPrompt = `You are TripMappa, a concise AI travel planner.
Respond with a JSON object only — no markdown, no extra text.
Keep all text extremely short and scannable.`;

  const userPrompt = needsOvernight
    ? `Plan a ${tripType.toLowerCase()} from ${origin} to ${destination}.
- Distance: ${routeInfo?.distance || "unknown"}
- Drive time: ${routeInfo?.duration || "unknown"}
- Vehicle: ${answers?.vehicle || "Car"}
- Fuel: ${answers?.fuel || "Gasoline"}
- Pets: ${answers?.pets === "Yes" ? `Yes — ${answers?.pet_desc}` : "No"}
- Lodging: ${answers?.lodging || "Mid-range"}
- Restaurants: ${answers?.restaurants || "No"}
- Notes: ${answers?.extra || "None"}

Suggest overnight stops with hotels and restaurants.

Return this JSON exactly:
{
  "stops": [
    {
      "city": "City, State",
      "distance": "XXX miles",
      "eta": "Xh Xm",
      "why": "5 words max",
      "type": "overnight",
      "hotels": [{ "name": "Hotel Name", "stars": 4, "price": "$XXX/night", "pet": true }],
      "restaurants": ${answers?.restaurants === "Yes" ? `[{ "name": "Restaurant Name", "cuisine": "Type", "rating": "4.5", "time": "7:00 PM" }]` : "[]"}
    }
  ],
  "tips": ["Short driving tip 1", "Short driving tip 2"]
}`
    : `Plan practical road stops for a ${tripType.toLowerCase()} from ${origin} to ${destination}.
- Distance: ${routeInfo?.distance || "unknown"}
- Drive time: ${routeInfo?.duration || "unknown"}
- Vehicle: ${answers?.vehicle || "Car"}
- Fuel: ${answers?.fuel || "Gasoline"}
- EV vehicle: ${isEV ? "Yes — include charging stops" : "No"}

Suggest categorized stops drivers actually use. For each location along the route suggest:
- Fuel stops: Buc-ee's, Pilot, Love's, Flying J, Wawa, Sheetz, QuikTrip
- Food stops: Chick-fil-A, Whataburger, Cracker Barrel, McDonald's, Sonic
- Rest stops: State rest areas, welcome centers, scenic overlooks
${isEV ? "- Charging stops: Tesla Supercharger, Electrify America, ChargePoint" : ""}

Return this JSON exactly — each stop must have a category:
{
  "road_stops": [
    {
      "location": "Exit 123, City, State",
      "distance": "XXX miles",
      "eta": "Xh Xm",
      "category": "fuel",
      "name": "Buc-ee's",
      "note": "Massive travel center · 120 pumps · clean restrooms"
    },
    {
      "location": "Exit 145, City, State",
      "distance": "XXX miles",
      "eta": "Xh Xm",
      "category": "food",
      "name": "Chick-fil-A",
      "note": "Quick drive-thru · reliable quality"
    },
    {
      "location": "City, State",
      "distance": "XXX miles",
      "eta": "Xh Xm",
      "category": "rest",
      "name": "Texas Welcome Center",
      "note": "Clean restrooms · pet area · free maps"
    }
  ],
  "tips": ["Short driving tip 1", "Short driving tip 2"]
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
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
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