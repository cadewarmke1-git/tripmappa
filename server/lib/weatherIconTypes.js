/** Map Google Weather condition strings to stable icon type slugs (no emoji). */
export function resolveWeatherIconType(conditionType) {
  if (!conditionType) return "default";
  const key = String(conditionType).toUpperCase().replace(/\s+/g, "_");
  if (key.includes("THUNDER") || key.includes("STORM")) return "storm";
  if (key.includes("HEAVY_RAIN") || key.includes("HEAVY") && key.includes("RAIN")) return "rain";
  if (key.includes("RAIN") || key.includes("DRIZZLE") || key.includes("SHOWER")) return "rain";
  if (key.includes("SNOW") || key.includes("SLEET") || key.includes("ICE")) return "snow";
  if (key.includes("FOG") || key.includes("MIST") || key.includes("HAZE")) return "fog";
  if (key.includes("WIND")) return "wind";
  if (key.includes("PARTLY") || key.includes("MOSTLY_CLEAR")) return "partly-cloudy";
  if (key.includes("CLOUD") || key.includes("OVERCAST")) return "cloudy";
  if (key.includes("CLEAR") || key.includes("SUNNY")) return "clear";
  return "default";
}
