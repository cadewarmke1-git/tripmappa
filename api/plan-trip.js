export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { origin, destination, answers, routeInfo } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  const systemPrompt = `You are TripMappa, a concise AI travel planner.
Respond with a JSON object only — no markdown, no extra text.
Keep all text extremely short and scannable. No long sentences.`;

  const userPrompt = `Plan a road trip:
- From: ${origin}
- To: ${destination}
- Distance: ${routeInfo?.distance || "unknown"}
- Drive time: ${routeInfo?.duration || "unknown"}
- Vehicle: ${answers?.vehicle || "Car"}
- Fuel: ${answers?.fuel || "Gasoline"}
- Pets: ${answers?.pets === "Yes" ? `Yes — ${answers?.pet_desc}` : "No"}
- Lodging: ${answers?.lodging || "Mid-range"}
- Restaurants: ${answers?.restaurants || "No"}
- Grocery: ${answers?.grocery || "No"}
- Notes: ${answers?.extra || "None"}

Return this JSON exactly:
{
  "greeting": "One short sentence, max 15 words, mentioning the route",
  "stops": [
    {
      "city": "City, State",
      "distance": "XXX miles",
      "eta": "Xh Xm",
      "why": "5 words max",
      "hotels": [
        { "name": "Hotel Name", "stars": 4, "price": "$XXX/night", "pet": true }
      ],
      "restaurants": [
        { "name": "Restaurant Name", "cuisine": "Type", "rating": "4.5", "time": "7:00 PM" }
      ]
    }
  ],
  "tips": ["Short tip 1", "Short tip 2", "Short tip 3"]
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
