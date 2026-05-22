export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    const { origin, destination, answers, routeInfo } = req.body;
  
    if (!origin || !destination) {
      return res.status(400).json({ error: "Missing origin or destination" });
    }
  
    const systemPrompt = `You are TripMappa, an expert AI travel planner. 
  You help users plan road trips with personalized hotel stops, restaurant recommendations, and route advice.
  Always respond with a JSON object only — no markdown, no extra text.
  Be specific, practical, and enthusiastic about travel.`;
  
    const userPrompt = `Plan a road trip with these details:
  - From: ${origin}
  - To: ${destination}
  - Distance: ${routeInfo?.distance || "unknown"}
  - Drive time: ${routeInfo?.duration || "unknown"}
  - Vehicle: ${answers?.vehicle || "Car"}
  - Fuel type: ${answers?.fuel || "Gasoline"}
  - Pets: ${answers?.pets === "Yes" ? `Yes — ${answers?.pet_desc}` : "No"}
  - Lodging preference: ${answers?.lodging || "Mid-range"}
  - Restaurants: ${answers?.restaurants || "No"}
  - Grocery delivery: ${answers?.grocery || "No"}
  - Extra notes: ${answers?.extra || "None"}
  
  Return a JSON object with this exact structure:
  {
    "greeting": "A warm, personalized opening message referencing their specific route and vehicle",
    "stops": [
      {
        "city": "City, State",
        "distance": "XXX miles from origin",
        "eta": "Xh Xm drive",
        "why": "One sentence why this is a great stop",
        "hotels": [
          { "name": "Hotel Name", "stars": 4, "price": "$XXX/night", "pet": true, "why": "Brief reason" }
        ],
        "restaurants": [
          { "name": "Restaurant Name", "cuisine": "Type", "rating": "4.5", "time": "7:00 PM", "why": "Brief reason" }
        ]
      }
    ],
    "tips": ["Tip 1 specific to their vehicle/route", "Tip 2", "Tip 3"]
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
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
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