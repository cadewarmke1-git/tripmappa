/** Corridor stop spacing rules injected into Sonnet system prompts. */

export function buildCorridorDistributionRules(ctx = {}) {
  const isEv = /electric|ev|tesla/i.test(ctx.fuel || "");
  const isTruck = ctx.tripCategory === "commercial";
  const isRv = /rv|camper/i.test(ctx.vehicle || "");
  const isScenic = ctx.isScenic;
  const isFamily = ctx.youngKids || ctx.partySize >= 3;
  const isContinuous = ctx.continuousDrive;
  const isDayTrip = ctx.tripType === "Day trip" || (ctx.routeDistanceMiles != null && ctx.routeDistanceMiles < 150);

  const spacing = isDayTrip ? "60–90" : "60–120";
  const fuelSpacing = isEv
    ? "no more than 80% of safe EV range apart"
    : "no more than 200 miles apart for gasoline/diesel";

  const lines = [
    "=== CORRIDOR STOP DISTRIBUTION (mandatory) ===",
    `- Place road_stops every ${spacing} miles along the ENTIRE route corridor — never cluster stops at the destination only.`,
    "- At least one food stop MUST appear in the FIRST THIRD of the route (by cumulative distance from origin).",
    `- Fuel/charging stops spaced ${fuelSpacing}.`,
    "- Destination city gets AT MOST 30% of total road_stops; distribute the remainder across mid-route corridor cities.",
    "- Use placesContext corridor samples and ROUTE GPS BOUNDARY coordinates — samples span the full route, not only endpoints.",
    "- distance and eta on each road_stop must increase monotonically from origin toward destination.",
  ];

  if (isContinuous) {
    lines.push("- Continuous drive: no overnight stops; space fuel and rest road_stops evenly across the full drive length.");
  }
  if (isDayTrip) {
    lines.push("- Day trip: include at least one corridor stop before the final 25% of route distance (not only at destination).");
  }
  if (isTruck) {
    lines.push("- Truck route: prioritize corridor truck stops and weigh-station awareness in the first two-thirds of the route, not only near destination.");
  }
  if (isEv) {
    lines.push("- EV route: charging stops must appear throughout the corridor within range limits — never only at the destination metro.");
  }
  if (isRv) {
    lines.push("- RV route: include fuel/propane and scenic pullout stops distributed along the corridor, not clustered at the endpoint.");
  }
  if (isScenic) {
    lines.push("- Scenic route: place at least one scenic viewpoint or discovery stop in the middle third of the corridor.");
  }
  if (isFamily) {
    lines.push("- Family trip: include kid-friendly food or playground breaks in the first half of the route, not only at the final city.");
  }
  if (ctx.tripType === "Plane" || ctx.tripType === "Boat" || ctx.tripType === "Ferry") {
    lines.push("- Water/air trip: destination-side recommendations only — no driving corridor road_stops.");
  }

  return lines.join("\n");
}
