/** DEV-only: render isolated surfaces for Playwright visual verification (real components, not HTML stubs). */
import MapInfoCard from "./map/MapInfoCard.jsx";
import GenerationStreamOverlay from "./GenerationStreamOverlay.jsx";
import TravelerOnboarding from "./TravelerOnboarding.jsx";
import TripResultsPanel from "./results/TripResultsPanel.jsx";
import "../styles/dev-visual-surface.css";

const MAP_MARKERS = {
  "map-popup-food": { id: "rs-food-1", title: "Magnolia Table", category: "food", lat: 31.551, lng: -97.151 },
  "map-popup-fuel": { id: "rs-fuel-1", title: "Buc-ee's", category: "fuel", lat: 31.552, lng: -97.152 },
};

const MOCK_RESULTS = {
  theme: "day",
  origin: "Dallas, TX",
  dest: "Austin, TX",
  answers: { vehicle: "Car", fuel_type: "Gasoline", travelers: "Just me" },
  stops: [{ id: "stop-1", city: "Waco, TX", name: "Waco Riverwalk", lat: 31.55, lng: -97.15 }],
  roadStops: [
    { id: "rs-food-1", title: "Magnolia Table", category: "food", lat: 31.551, lng: -97.151 },
    { id: "rs-fuel-1", title: "Buc-ee's", category: "fuel", lat: 31.552, lng: -97.152 },
  ],
  routeInfo: {
    distance: "196 mi",
    duration: "3 hours 5 mins",
    citiesAlongRoute: ["Waco, TX", "Austin, TX"],
    routePoints: [
      { lat: 32.7767, lng: -96.797 },
      { lat: 31.5493, lng: -97.1467 },
      { lat: 30.2672, lng: -97.7431 },
    ],
  },
  tripLegs: [],
  tripFormat: null,
};

export default function DevVisualSurface({ surface, theme = "night" }) {
  if (surface === "onboarding") {
    return <TravelerOnboarding onComplete={() => { window.location.href = "/"; }} />;
  }

  if (surface === "map-popup-food" || surface === "map-popup-fuel") {
    const mapTheme = surface === "map-popup-food" ? "day" : "night";
    const marker = MAP_MARKERS[surface];
    return (
      <div className={`app-wrap ${mapTheme} map-fullscreen-mode dev-visual-map-surface`}>
        <div className="dev-visual-map-bg" aria-hidden="true" />
        <MapInfoCard marker={marker} theme={mapTheme} onClose={() => {}} />
      </div>
    );
  }

  if (surface === "generation-loader") {
    const progress = {
      phase: "stops",
      message: "Finding stops along your route…",
      cityNames: ["Waco, TX", "Austin, TX"],
      routeSummary: "Dallas to Austin",
    };
    return (
      <div className="app-wrap night dev-visual-loader-surface">
        <GenerationStreamOverlay
          progress={progress}
          origin="Dallas, TX"
          dest="Austin, TX"
          vehicleType="Car"
          theme="night"
          routeCities={["Waco, TX", "Austin, TX"]}
        />
      </div>
    );
  }

  if (surface === "results-day") {
    const resultsTheme = "day";
    return (
      <div className={`app-wrap ${resultsTheme} results-fullscreen dev-visual-results-surface`}>
        <TripResultsPanel
          theme={resultsTheme}
          origin={MOCK_RESULTS.origin}
          dest={MOCK_RESULTS.dest}
          answers={MOCK_RESULTS.answers}
          stops={MOCK_RESULTS.stops}
          roadStops={MOCK_RESULTS.roadStops}
          routeInfo={MOCK_RESULTS.routeInfo}
          tripLegs={MOCK_RESULTS.tripLegs}
          tripFormat={MOCK_RESULTS.tripFormat}
          onEditTrip={() => {}}
          onViewMap={() => {}}
          onShare={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="app-wrap day" style={{ padding: 24 }}>
      <p>Unknown visual surface: {surface}</p>
    </div>
  );
}
