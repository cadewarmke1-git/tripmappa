export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { origin, destination, answers, routeInfo } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  const tripType = answers?.trip_type || "Road trip";
  const needsOvernight = answers?.overnight === "Yes" || tripType === "Road trip";

  const systemPrompt = `You are TripMappa, a concise AI travel planner.
Respond with a JSON object only — no markdown, no extra text.
Keep all text extremely short and scannable.`;

  const userPrompt = `Plan a ${tripType.toLowerCase()} from ${origin} to ${destination}.
- Distance: ${routeInfo?.distance || "unknown"}
- Drive time: ${routeInfo?.duration || "unknown"}
- Vehicle: ${answers?.vehicle || "Car"}
- Fuel: ${answers?.fuel || "Gasoline"}
- Pets: ${answers?.pets === "Yes" ? `Yes — ${answers?.pet_desc}` : "No"}
- Overnight stops needed: ${needsOvernight ? "Yes" : "No"}
- Lodging: ${answers?.lodging || "N/A"}
- Restaurants: ${answers?.restaurants || "No"}
- Grocery: ${answers?.grocery || "No"}
- Notes: ${answers?.extra || "None"}

${needsOvernight ? `Return stops with hotels and restaurants.` : `Return fuel/rest stops only — no hotels needed.`}

Return this JSON exactly:
{
  "stops": [
    {
      "city": "City, State",
      "distance": "XXX miles",
      "eta": "Xh Xm",
      "why": "5 words max",
      "hotels": ${needsOvernight ? `[{ "name": "Hotel Name", "stars": 4, "price": "$XXX/night", "pet": true }]` : "[]"},
      "restaurants": ${answers?.restaurants === "Yes" ? `[{ "name": "Restaurant Name", "cuisine": "Type", "rating": "4.5", "time": "7:00 PM" }]` : "[]"}
    }
  ],
  "tips": ["Short tip 1", "Short tip 2"]
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
        max_tokens: 1000,
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
