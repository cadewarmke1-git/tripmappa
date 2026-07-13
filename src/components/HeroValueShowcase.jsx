const SAMPLE_STOPS = [
  { name: "Buc-ee's", type: "Fuel", mile: "142" },
  { name: "Matt's El Rancho", type: "Food", mile: "218" },
  { name: "Hotel Paisano", type: "Lodging", mile: "385" },
];

const FEATURES = [
  {
    title: "Vehicle-specific routing",
    detail: "RV clearances, truck HOS, motorcycle twisties",
  },
  {
    title: "Verified stops",
    detail: "Real fuel, food, and lodging along your route",
  },
  {
    title: "Neon map signs",
    detail: "Vintage signs at every stop on the map",
  },
];

const TYPE_COLORS = {
  Fuel: "#3dd9d0",
  Food: "#ff5fa8",
  Lodging: "#FFD28C",
};

export default function HeroValueShowcase() {
  return (
    <div className="hero-value-showcase" aria-label="Trip preview and features">
      <div className="hero-value-trip-card">
        <div className="hero-value-trip-route">
          <span className="hero-value-city">Dallas</span>
          <span className="hero-value-arrow" aria-hidden="true">→</span>
          <span className="hero-value-city">Los Angeles</span>
          <span className="hero-value-distance">1,440 mi · 3 days</span>
        </div>
        <ol className="hero-value-stops">
          {SAMPLE_STOPS.map((stop, index) => (
            <li className="hero-value-stop" key={stop.name}>
              <span className="hero-value-stop-num" aria-hidden="true">{index + 1}</span>
              <span
                className="hero-value-stop-sign"
                style={{ "--stop-accent": TYPE_COLORS[stop.type] || "#5a9e96" }}
              >
                <span className="hero-value-stop-type">{stop.type}</span>
                <span className="hero-value-stop-name">{stop.name}</span>
              </span>
              <span className="hero-value-stop-mile">{stop.mile} mi</span>
            </li>
          ))}
        </ol>
      </div>

      <ul className="hero-value-features">
        {FEATURES.map(feature => (
          <li className="hero-value-feature" key={feature.title}>
            <span className="hero-value-feature-title">{feature.title}</span>
            <span className="hero-value-feature-detail">{feature.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
