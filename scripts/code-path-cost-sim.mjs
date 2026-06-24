/**
 * Final code-path cost simulation — OSM-first discovery, mandatory name resolution + Details on display.
 * Run: node scripts/code-path-cost-sim.mjs
 *
 * This is a code-path estimate, not a measurement of real Google billing.
 */
import { shouldPrefetchPlacesContext } from "../src/lib/placesContext.js";
import { estimateOvernightStops } from "../src/lib/budget.js";
import { getActiveServiceCategoryIds } from "../src/lib/tripAccommodations.js";
import { getDietarySearchKeywords } from "../src/lib/dietaryKeywords.js";

const MAX_NEARBY = 15;
const MAX_DETAILS = 8;
const DENSE_SAMPLE_INTERVAL = 30;

const RATES = {
  nearby: 32.0,
  details: 17.0,
  placesPhoto: 7.0,
  mapsJs: 7.0,
  directions: 5.0,
};

function corridorSampleCount(miles) {
  return Math.max(2, Math.floor(miles / DENSE_SAMPLE_INTERVAL) + 1);
}

function osmSegmentCount(miles) {
  return Math.max(1, Math.ceil(miles / DENSE_SAMPLE_INTERVAL));
}

function estimateOvernightCityCount(miles, hours, answers, corridorCityCount) {
  const nights = estimateOvernightStops(hours, answers?.trip_type, answers?.lodging);
  return Math.max(1, Math.min(5, nights || corridorCityCount || 2));
}

/** Google Nearby gap-fill only when OSM has zero POIs of any kind (not unnamed-only gaps). */
function googleCorridorGapAttempts(sampleCount, evTrip = false) {
  let gaps = Math.ceil(sampleCount * 0.08);
  if (evTrip) gaps += Math.ceil(sampleCount * 0.5);
  return gaps;
}

/** Hybrid/trucker brand gap-fill; car road stops mostly OSM with sparse Google fallback. */
function roadStopNearbyGapAttempts(sampleCount, hybrid) {
  return hybrid ? Math.ceil(sampleCount * 0.15) : Math.ceil(sampleCount * 0.06);
}

/** Discovery rotation (cafe/bakery) — Google only when OSM has no POI at all for that segment. */
function discoveryNearbyGapAttempts(sampleCount) {
  return Math.ceil(sampleCount * 0.04);
}

/**
 * Every displayed stop incurs name-resolution + Details on first display.
 * OSM unnamed → targeted resolve (1 Nearby + 1 Details); Google candidates → 1 Details.
 * Supabase place_details_cache eliminates repeat Details on cached corridors.
 */
function estimateDisplayedStopDetails({
  roadCards,
  lodgingCards,
  restaurantCards,
  foodRoadStops,
}) {
  const osmShare = 0.55;
  const resolveNearbyPerStop = roadCards * osmShare * 0.35;
  const detailsPerStop = roadCards + lodgingCards + restaurantCards + Math.ceil(foodRoadStops * 1.5);
  return {
    nearby: resolveNearbyPerStop,
    details: detailsPerStop,
  };
}

function applyNearbyCap(attempts, budget, live) {
  if (!live) return 0;
  const n = Math.max(0, Number(attempts) || 0);
  const billed = Math.min(Math.ceil(n), Math.max(0, MAX_NEARBY - budget.nearby));
  budget.nearby += billed;
  return billed;
}

function applyDetailsCap(attempts, budget, live) {
  if (!live) return 0;
  const n = Math.max(0, Math.ceil(Number(attempts) || 0));
  const billed = Math.min(n, Math.max(0, MAX_DETAILS - budget.details));
  budget.details += billed;
  return billed;
}

function cost(counts) {
  let total = 0;
  for (const [k, rate] of Object.entries(RATES)) {
    total += ((counts[k] || 0) / 1000) * rate;
  }
  return total;
}

function simulate(cfg) {
  const {
    miles,
    hours,
    answers,
    stopsCount,
    foodRoadStops,
    fullyCached,
    corridorCityCount,
    enrichDestination,
    hybrid = false,
  } = cfg;

  const routeInfo = { distance: `${miles} mi`, duration: `${hours} hours`, routePoints: [{}] };
  const liveNearby = !fullyCached;
  const liveDetails = !fullyCached;

  const counts = { nearby: 0, details: 0, directions: 1, mapsJs: 1, placesPhoto: 0 };
  const samples = corridorSampleCount(miles);
  const prefetch = shouldPrefetchPlacesContext(answers, routeInfo);
  const dietaryKw = getDietarySearchKeywords(answers).filter(k => !/drive through/i.test(k));
  const serviceCats = getActiveServiceCategoryIds(answers).length;
  const needsOvernight = answers?.overnight_preference === "Stop overnight along the way";
  const overnightCities = prefetch && needsOvernight
    ? estimateOvernightCityCount(miles, hours, answers, corridorCityCount)
    : 0;

  const tripBudget = { nearby: 0, details: 0 };

  if (prefetch) {
    counts.nearby += applyNearbyCap(googleCorridorGapAttempts(samples), tripBudget, liveNearby);

    for (let c = 0; c < overnightCities; c++) {
      counts.nearby += applyNearbyCap(0.2, tripBudget, liveNearby);
      if (dietaryKw.length) {
        counts.nearby += applyNearbyCap(0.35, tripBudget, liveNearby);
      }
    }
  }

  counts.nearby += applyNearbyCap(roadStopNearbyGapAttempts(samples, hybrid), tripBudget, liveNearby);
  counts.nearby += applyNearbyCap(discoveryNearbyGapAttempts(samples), tripBudget, liveNearby);

  for (let s = 0; s < stopsCount; s++) {
    counts.nearby += applyNearbyCap(serviceCats, tripBudget, liveNearby);
    counts.nearby += applyNearbyCap(0.6, tripBudget, liveNearby);
  }
  if (stopsCount === 0 && enrichDestination) {
    counts.nearby += applyNearbyCap(0.6, tripBudget, liveNearby);
  }
  counts.nearby += applyNearbyCap(Math.ceil(foodRoadStops * 0.25), tripBudget, liveNearby);

  const finalRoadCards = Math.min(12, samples);
  const lodgingCards = overnightCities * 4;
  const restaurantCards = stopsCount + (enrichDestination ? 1 : 0);
  const displayCosts = estimateDisplayedStopDetails({
    roadCards: finalRoadCards,
    lodgingCards,
    restaurantCards: Math.ceil(restaurantCards * 2.5),
    foodRoadStops,
  });

  counts.nearby += applyNearbyCap(displayCosts.nearby, tripBudget, liveNearby);
  counts.details += applyDetailsCap(displayCosts.details, tripBudget, liveDetails);

  counts.placesPhoto = fullyCached ? 0 : Math.min(finalRoadCards, Math.ceil(finalRoadCards * 0.85));

  return {
    ...cfg,
    prefetch,
    samples,
    osmSegments: osmSegmentCount(miles),
    overnightCities,
    counts,
    total: cost(counts),
    tripBudget,
    displayDetailsAttempted: displayCosts.details,
    displayResolveNearby: displayCosts.nearby,
  };
}

const baseCar = {
  vehicle: "Car",
  fuel_type: "Gasoline",
  trip_type: "Road trip",
  stops_interests: ["No specific interests"],
  dietary: [],
  accessibility: [],
};

const scenarios = [
  {
    label: "S1 — 250 mi day trip (no overnight)",
    miles: 250,
    hours: 4.5,
    answers: { ...baseCar, trip_type: "Day trip", lodging: "No overnight stay" },
    stopsCount: 0,
    enrichDestination: true,
    foodRoadStops: 1,
    corridorCityCount: 2,
  },
  {
    label: "S2 — 500 mi, 1 overnight",
    miles: 500,
    hours: 8,
    answers: {
      ...baseCar,
      trip_type: "Road trip",
      overnight_preference: "Stop overnight along the way",
      lodging: "Hotel or motel",
    },
    stopsCount: 1,
    enrichDestination: false,
    foodRoadStops: 2,
    corridorCityCount: 3,
  },
  {
    label: "S3 — 1,200 mi, 3 overnights",
    miles: 1200,
    hours: 34,
    answers: {
      ...baseCar,
      trip_type: "Road trip",
      overnight_preference: "Stop overnight along the way",
      lodging: "Hotel or motel",
    },
    stopsCount: 3,
    enrichDestination: false,
    foodRoadStops: 2,
    corridorCityCount: 5,
  },
];

console.log("=== Code-path Google cost estimate (mandatory display enrichment) ===");
console.log("(Not a measurement of real billing — models implemented code paths only)\n");
console.log("Assumption: every displayed hotel/restaurant/road-stop card pays name-resolution");
console.log("+ Place Details on first display; Details cache hits on repeat corridors.\n");
console.log("Rates: Nearby $32/1k | Details $17/1k | Directions $5/1k | Dynamic Maps $7/1k\n");
console.log("OSM Overpass: $0 (not billed by Google)\n");

const rows = [];

for (const sc of scenarios) {
  const fresh = simulate({ ...sc, fullyCached: false });
  const cached = simulate({ ...sc, fullyCached: true });
  rows.push({ scenario: sc.label, fresh, cached });

  console.log(sc.label);
  console.log(`  Route: ${sc.miles} mi | Corridor samples @ 30 mi: ${fresh.samples} | OSM segments: ${fresh.osmSegments}`);
  console.log("  Fresh trip (no Supabase cache hits):");
  console.log(`    Nearby: ${fresh.counts.nearby} (incl. ~${Math.ceil(fresh.displayResolveNearby)} targeted resolves) | Details: ${fresh.counts.details} (attempted ~${fresh.displayDetailsAttempted}, cap ${MAX_DETAILS}) | Photos: ${fresh.counts.placesPhoto}`);
  console.log(`    Estimated cost: $${fresh.total.toFixed(3)}`);
  console.log("  Fully cached trip (OSM + Nearby + Details from prior user on same corridor):");
  console.log(`    Nearby: ${cached.counts.nearby} | Details: ${cached.counts.details} | Photos: ${cached.counts.placesPhoto}`);
  console.log(`    Estimated cost: $${cached.total.toFixed(3)}  (Directions + Maps JS load only)`);
  console.log("");
}

console.log("--- Summary table ---");
console.log("Scenario".padEnd(42), "Fresh".padStart(8), "Fully cached".padStart(14));
for (const { scenario, fresh, cached } of rows) {
  console.log(scenario.padEnd(42), `$${fresh.total.toFixed(3)}`.padStart(8), `$${cached.total.toFixed(3)}`.padStart(14));
}
