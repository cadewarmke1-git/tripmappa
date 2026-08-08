/**
 * Zero-cost personalization layers pass — mocked/fixture data only.
 * No live EIA, Google Places, HERE, or Claude calls.
 *
 * Run: npx vitest run src/lib/personalizationLayers.zeroCost.test.js
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyAssumedVehicleSpecs,
  getEffectiveVehicle,
  isRvVehicle,
  isTruckVehicle,
} from "./vehicles.js";
import {
  shouldUseTruckRouting,
  buildTruckRoutingPayload,
} from "./truckRoutingApi.js";
import { resolveTruckRequestSpecs } from "../../server/lib/truckSpecs.js";
import {
  EV_CHARGE_INTERVAL_MILES,
  buildFuelIntervalPoints,
  getFuelStopIntervalCount,
  getFuelStopMode,
} from "./fuel.js";
import {
  dietaryMatchesRestaurant,
} from "./dietaryKeywords.js";
import { filterByPreferences } from "../../server/lib/restaurantPreferences.js";
import {
  filterLodgingByTier,
  filterGenericChains,
  filterRatingBand,
} from "./placesFilters.js";
import {
  deriveStopCountFromPace,
  deriveTripBudgetFromLuxury,
  normalizeTripAnswers,
} from "./tripFlow.js";
import {
  buildRecentTripsContext,
  formatLuxuryLevelLine,
  formatPetConstraintLine,
  formatStopFrequencyLine,
  stripAnswersForSonnet,
} from "./generationContext.js";
import {
  buildTravelerDossier,
  buildUserPatternSummary,
  buildRecentTripsPreferencesRollup,
} from "./tripHistoryAnalysis.js";
import {
  formatPreferencesForPrompt,
  mergeStopIntoPreferences,
  finalizeTripPreferenceStats,
} from "../../server/routes/user-trip-preferences.js";
import { formatPlacesContextForPrompt } from "./placesContext.js";
import {
  applyContextToPlaceList,
  buildSegmentContexts,
  classifyWeatherSeverity,
  formatSegmentContextBlock,
  formatSegmentContextLine,
  fuelPreferFill,
  isLikelyOpenAtArrival,
  weatherScoreAdjustment,
  daylightScoreAdjustment,
} from "./segmentContext.js";
import { applySegmentContextToPlaces } from "./applySegmentContext.js";
import {
  paddFromCoords,
  formatGalPrice,
} from "../../server/lib/eiaFuelPrices.js";
import {
  REJECTION_SOURCE,
  clearPendingStopRejections,
  mergeStopRejection,
  describeStopRejection,
  sanitizeStopRejections,
  scheduleStopRejection,
  pendingStopRejectionCount,
  REJECTION_UNDO_DELAY_MS,
} from "./stopRejectionPreferences.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EIA_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "__fixtures__/eia-diag-padd-samples.json"), "utf8"),
);

/** @type {{ layer: string, scenario: string, pass: boolean, output: unknown, error?: string }[]} */
const REPORT = [];

function record(layer, scenario, pass, output, error) {
  REPORT.push({ layer, scenario, pass, output, error });
}

function sampleRoute(n = 21) {
  // Dallas → El Paso-ish polyline
  const a = { lat: 32.7767, lng: -96.797 };
  const b = { lat: 31.7619, lng: -106.485 };
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  });
}

function eiaJsonForDuoarea(duoarea) {
  const fix = EIA_FIXTURE[duoarea] || EIA_FIXTURE.NUS;
  return {
    response: {
      total: String(fix.sampleRows.length),
      dateFormat: "YYYY-MM-DD",
      frequency: "weekly",
      data: fix.sampleRows,
    },
  };
}

describe("Personalization layers — zero-cost pass", () => {
  const originalFetch = globalThis.fetch;

  afterAll(() => {
    const outPath = path.join(process.cwd(), "tmp", "personalization-layers-zero-cost-report.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const summary = {
      capturedAt: new Date().toISOString(),
      total: REPORT.length,
      passed: REPORT.filter((r) => r.pass).length,
      failed: REPORT.filter((r) => !r.pass).length,
      rows: REPORT,
    };
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

    const mdPath = path.join(process.cwd(), "tmp", "personalization-layers-zero-cost-report.md");
    const lines = [
      "# Personalization layers — zero-cost pass",
      "",
      `| Layer | Scenario | Result | Output |`,
      `|---|---|---|---|`,
      ...REPORT.map((r) => {
        const out = JSON.stringify(r.output);
        const clipped = out.length > 220 ? `${out.slice(0, 217)}…` : out;
        return `| ${r.layer} | ${r.scenario} | ${r.pass ? "PASS" : "FAIL"} | \`${clipped.replace(/\|/g, "\\|")}\` |`;
      }),
      "",
      `**Totals:** ${summary.passed}/${summary.total} passed`,
    ];
    fs.writeFileSync(mdPath, lines.join("\n"));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearPendingStopRejections();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Layer 1 ───────────────────────────────────────────────────────────
  describe("Layer 1 — vehicle / fuel hard constraints", () => {
    it("RV: no HERE truck routing; fuel mode rv; assumed specs", () => {
      const answers = applyAssumedVehicleSpecs({ vehicle: "RV" });
      const mode = getFuelStopMode(answers);
      const useTruck = shouldUseTruckRouting(answers);
      const out = {
        vehicle: getEffectiveVehicle(answers),
        isRv: isRvVehicle(answers.vehicle),
        shouldUseTruckRouting: useTruck,
        fuelMode: mode,
        rv_height: answers.rv_height,
        rv_weight: answers.rv_weight,
        intervalCount_600mi: getFuelStopIntervalCount(answers, 600, 1),
      };
      const pass = out.isRv && !out.shouldUseTruckRouting && out.fuelMode === "rv"
        && out.rv_height === "11'0\"" && out.intervalCount_600mi >= 2;
      record("L1", "RV routing + fuel mode", pass, out);
      expect(pass).toBe(true);
    });

    it("Semi: HERE truck payload + metric specs + diesel mode", () => {
      const answers = applyAssumedVehicleSpecs({
        vehicle: "Semi Truck (18-wheeler)",
        truck_hazmat: "No",
      });
      const payload = buildTruckRoutingPayload(
        { lat: 32.78, lng: -96.8 },
        { lat: 31.76, lng: -106.49 },
        answers,
      );
      const specs = resolveTruckRequestSpecs(payload);
      const hereParams = {
        transportMode: "truck",
        "vehicle[height]": String(specs.heightCm),
        "vehicle[grossWeight]": String(specs.weightKg),
        "vehicle[axleCount]": String(specs.axleCount),
        hazmat: specs.hazmat,
      };
      const out = {
        shouldUseTruckRouting: shouldUseTruckRouting(answers),
        isTruck: isTruckVehicle(answers.vehicle),
        fuelMode: getFuelStopMode(answers),
        payload,
        hereParams,
      };
      const pass = out.shouldUseTruckRouting
        && out.fuelMode === "diesel"
        && hereParams.transportMode === "truck"
        && Number(hereParams["vehicle[height]"]) === 411
        && Number(hereParams["vehicle[grossWeight]"]) === 36287
        && Number(hereParams["vehicle[axleCount]"]) === 5
        && hereParams.hazmat === false;
      record("L1", "Semi HERE truck params + diesel", pass, out);
      expect(pass).toBe(true);
    });

    it("Motorcycle: Google-path (no truck routing); gas mode", () => {
      const answers = { vehicle: "Motorcycle", fuel_type: "Gasoline" };
      const out = {
        shouldUseTruckRouting: shouldUseTruckRouting(answers),
        fuelMode: getFuelStopMode(answers),
        intervalCount_400mi: getFuelStopIntervalCount(answers, 400, 0),
      };
      const pass = !out.shouldUseTruckRouting && out.fuelMode === "gas" && out.intervalCount_400mi >= 1;
      record("L1", "Motorcycle routing + gas stops", pass, out);
      expect(pass).toBe(true);
    });

    it("EV: charging intervals every 200mi; required mid-segment when over range", () => {
      const answers = { vehicle: "Car", fuel_type: "Electric" };
      const route = sampleRoute(41);
      const points = buildFuelIntervalPoints(route, 0, 450, answers);
      const out = {
        fuelMode: getFuelStopMode(answers),
        EV_CHARGE_INTERVAL_MILES,
        intervalCount: getFuelStopIntervalCount(answers, 450, 0),
        checkpointCount: points.length,
        requiredLabels: points.filter((p) => p.required).map((p) => p.label),
      };
      const pass = out.fuelMode === "ev"
        && out.intervalCount === Math.ceil(450 / EV_CHARGE_INTERVAL_MILES)
        && out.requiredLabels.some((l) => /200 mi/i.test(l || ""));
      record("L1", "EV charging interval logic", pass, out);
      expect(pass).toBe(true);
    });
  });

  // ─── Layer 2 ───────────────────────────────────────────────────────────
  describe("Layer 2 — preference filtering + stop frequency", () => {
    it("dietary exclusion keeps vegan-matching only", () => {
      const answers = { dietary: ["Vegan"] };
      const pool = [
        { name: "Texas Steakhouse", types: ["steak_house"] },
        { name: "Green Leaf Vegan Kitchen", types: ["vegan_restaurant"] },
        { name: "Burger Barn", types: ["hamburger_restaurant"] },
      ];
      const kept = pool.filter((p) => dietaryMatchesRestaurant(p, answers));
      const filtered = filterByPreferences(pool, answers);
      const out = { kept: kept.map((p) => p.name), filtered: filtered.map((p) => p.name) };
      const pass = out.kept.length === 1 && out.kept[0] === "Green Leaf Vegan Kitchen"
        && out.filtered.length === 1;
      record("L2", "Dietary exclusion", pass, out);
      expect(pass).toBe(true);
    });

    it("luxury price-tier filtering + budget mapping", () => {
      const answers = { lodging: "Luxury", luxury_level: "5" };
      const hotels = [
        { name: "Motel 6", priceLevel: 1, rating: 3.2, estimatedNightly: 59 },
        { name: "Courtyard", priceLevel: 2, rating: 4.1, estimatedNightly: 140 },
        { name: "Ritz Plaza", priceLevel: 4, rating: 4.7, estimatedNightly: 320 },
      ];
      // estimateNightlyFromPlace uses price/priceLevel — set price strings
      const withPrices = hotels.map((h) => ({
        ...h,
        price: `$${h.estimatedNightly}/night`,
      }));
      const filtered = filterLodgingByTier(withPrices, answers);
      const budget = deriveTripBudgetFromLuxury(answers.luxury_level);
      const luxuryLine = formatLuxuryLevelLine({ ...answers, lodging: "Luxury" });
      const out = {
        filtered: filtered.map((h) => h.name),
        trip_budget: budget,
        luxuryLine,
      };
      const pass = out.filtered.includes("Ritz Plaza")
        && !out.filtered.includes("Motel 6")
        && budget === "Over $1000"
        && /Luxury/i.test(luxuryLine || "");
      record("L2", "Luxury tier filter + budget", pass, out);
      expect(pass).toBe(true);
    });

    it("pet-friendly: hard constraint line + unknown seating retained", () => {
      const answers = { preferences: ["Pet friendly"] };
      const pool = [
        { name: "Patio Pups Cafe", types: ["restaurant", "bar"] },
        { name: "Quiet Bistro", types: ["restaurant"] },
        { name: "Unknown Diner", types: ["restaurant"] },
      ];
      const filtered = filterByPreferences(pool, answers);
      const line = formatPetConstraintLine(answers);
      const out = {
        constraint: line,
        names: filtered.map((p) => p.name),
        badges: Object.fromEntries(filtered.map((p) => [p.name, p.badges || []])),
      };
      // Soft path: nobody dropped (unknown pet policy retained); patio gets outdoorSeating
      const pass = filtered.length === 3
        && /pet-friendly/i.test(line || "")
        && out.badges["Patio Pups Cafe"].includes("outdoorSeating")
        && (out.badges["Unknown Diner"] || []).length === 0;
      record("L2", "Pet-friendly constraint + unknown retention", pass, out);
      expect(pass).toBe(true);
    });

    it("over-filtering to empty pool degrades to original", () => {
      const places = [
        { name: "McDonald's", types: ["fast_food_restaurant"], rating: 3.5, userRatingsTotal: 20000 },
        { name: "Burger King", types: ["fast_food_restaurant"], rating: 3.2, userRatingsTotal: 15000 },
      ];
      const chains = filterGenericChains(places, { allowChains: false });
      const rated = filterRatingBand(places, { minRating: 4.9, minReviews: 50, maxReviews: 100 });
      const out = {
        chainFilterResult: chains.map((p) => p.name),
        ratingFilterResult: rated.map((p) => p.name),
        degradedChains: chains.length === places.length,
        degradedRating: rated.length === places.length,
      };
      const pass = out.degradedChains && out.degradedRating;
      record("L2", "Empty-pool degradation", pass, out);
      expect(pass).toBe(true);
    });

    it("stop-frequency governs slot count labels", () => {
      const ctx300 = { routeDistance: "300 mi" };
      const out = {
        Minimal_300: deriveStopCountFromPace("Minimal", ctx300),
        Moderate_300: deriveStopCountFromPace("Moderate", ctx300),
        Frequent_300: deriveStopCountFromPace("Frequent", ctx300),
        Frequent_150: deriveStopCountFromPace("Frequent", { routeDistance: "150 mi" }),
        frequencyLine: formatStopFrequencyLine({ stop_frequency: "Frequent", stop_count: deriveStopCountFromPace("Frequent", ctx300) }),
      };
      // normalizeTripAnswers should stamp stop_count from pace
      const normalized = normalizeTripAnswers(
        { vehicle: "Car", stop_frequency: "Frequent" },
        { routeDistance: "300 mi" },
      );
      out.normalized_stop_count = normalized.stop_count;
      const pass = out.Minimal_300 === "A few (2-3)"
        && out.Moderate_300 === "A few (2-3)"
        && out.Frequent_300 === "Plenty (7+)"
        && out.Frequent_150 === "Several (4-6)"
        && out.normalized_stop_count === "Plenty (7+)";
      record("L2", "Stop-frequency → slot count", pass, out);
      expect(pass).toBe(true);
    });
  });

  // ─── Layer 3 ───────────────────────────────────────────────────────────
  describe("Layer 3 — compressed context + memory profile", () => {
    const history = [
      {
        origin: "Dallas, TX",
        dest: "Austin, TX",
        answers: {
          vehicle: "SUV or Van",
          lodging: "Mid-Range",
          preferences: ["Pet friendly", "Scenic route"],
          dietary: ["Vegetarian"],
          trip_budget: "$500 to $1000",
          travelers: "3 to 5",
          kids_ages: ["6", "9"],
          accessibility: ["Traveling with young children"],
        },
        roadStops: [
          { name: "Pilot Travel Center", category: "fuel", userAdded: true },
          { name: "Green Bowl Vegetarian", category: "restaurant", cuisine: "Vegetarian", userAdded: true },
        ],
      },
      {
        origin: "Austin, TX",
        dest: "Houston, TX",
        answers: {
          vehicle: "SUV or Van",
          lodging: "Mid-Range",
          preferences: ["Pet friendly", "Scenic route"],
          dietary: ["Vegetarian"],
          trip_budget: "$500 to $1000",
        },
        roadStops: [
          { name: "Love's", category: "fuel", userAdded: true },
        ],
      },
      {
        origin: "Houston, TX",
        dest: "New Orleans, LA",
        answers: {
          vehicle: "SUV or Van",
          lodging: "Mid-Range",
          preferences: ["Pet friendly", "Scenic route"],
          dietary: ["Vegetarian"],
          trip_budget: "$500 to $1000",
        },
        roadStops: [],
      },
      {
        origin: "New Orleans, LA",
        dest: "Mobile, AL",
        answers: {
          vehicle: "SUV or Van",
          lodging: "Mid-Range",
          preferences: ["Scenic route"],
          dietary: ["Vegetarian"],
          trip_budget: "$500 to $1000",
        },
        roadStops: [
          { name: "Shell", category: "fuel", userAdded: true },
        ],
      },
      {
        origin: "Mobile, AL",
        dest: "Pensacola, FL",
        answers: {
          vehicle: "SUV or Van",
          lodging: "Mid-Range",
          preferences: ["Pet friendly", "Scenic route"],
          dietary: ["Vegetarian"],
          trip_budget: "$500 to $1000",
        },
        roadStops: [
          { name: "Pilot", category: "fuel", userAdded: true },
          { name: "Canyon Overlook", category: "scenic", userAdded: false },
        ],
      },
    ];

    it("compressed memory profile from accepted trip history", () => {
      let prefs = null;
      for (const trip of history) {
        for (const stop of (trip.roadStops || []).filter((s) => s.userAdded)) {
          prefs = mergeStopIntoPreferences(prefs, stop);
        }
        prefs = finalizeTripPreferenceStats(prefs, (trip.roadStops || []).filter((s) => s.userAdded).length || 1);
      }
      // Rejected stop (not userAdded) must not inflate learned prefs
      const rejectedOnly = mergeStopRejection(
        null,
        { name: "Canyon Overlook", category: "scenic" },
        "road",
        REJECTION_SOURCE.itinerary_remove,
      );

      const dossier = buildTravelerDossier(history, history[0].answers);
      const patterns = buildUserPatternSummary(history);
      const rollup = buildRecentTripsPreferencesRollup(history);
      const recentCtx = buildRecentTripsContext(history, 3);
      const prefsBlock = formatPreferencesForPrompt(prefs, rollup);

      const out = {
        prefs: {
          trip_count: prefs.trip_count,
          avg_stops_per_trip: prefs.avg_stops_per_trip,
          stop_categories: prefs.stop_categories,
          fuel_brands: prefs.fuel_brands,
          restaurant_types: prefs.restaurant_types,
        },
        rejectionFromNonAccepted: rejectedOnly,
        dossierHead: dossier.split("\n")[0],
        dossierBody: dossier.split("\n").slice(1).join(" "),
        patterns,
        prefsBlockHead: prefsBlock.split("\n")[0],
        recentCtxHead: recentCtx.split("\n")[0],
      };

      const pass = prefs.trip_count === 5
        && (prefs.fuel_brands.Pilot || 0) >= 2
        && !prefs.stop_categories.attraction
        && /TRAVELER DOSSIER/.test(dossier)
        && /USER TRAVEL PATTERNS/.test(patterns)
        && /USER LEARNED PREFERENCES/.test(prefsBlock)
        && /RECENT TRIP HISTORY/.test(recentCtx)
        && /Vegetarian|pet|scenic|Mid-Range|mid-range/i.test(`${dossier}\n${patterns}`);
      record("L3", "Compressed memory profile structure", pass, out);
      expect(pass).toBe(true);
    });

    it("compressed context line replaces prose (stripAnswers + places ranking role)", () => {
      const answers = {
        vehicle: "Car",
        dietary: ["Vegan"],
        restaurant_preference: "Steakhouse", // contradictory — must strip
        preferences: ["Pet friendly"],
      };
      const stripped = stripAnswersForSonnet(answers);
      const placesPrompt = formatPlacesContextForPrompt({
        corridor: [{
          lat: 32.8,
          lng: -96.8,
          restaurants: [{ name: "Adobe Cafe", rating: 4.2, types: ["cafe"] }],
          gasStations: [{ name: "Shell", rating: 4.0 }],
        }],
        cities: [],
        boundary: { totalMiles: 100 },
        segmentContextPrompt: "=== SEGMENT CONTEXT ===\nSEG1 98F heat day fuel$3.59 (gulf) preferIndoor",
      });
      const out = {
        strippedHasRestaurantPref: "restaurant_preference" in stripped,
        strippedDietary: stripped.dietary,
        placesPromptHasRankingRole: /context-scored at generation time/i.test(placesPrompt),
        placesPromptHasSeg: /SEG1/.test(placesPrompt),
        placesPromptSnippet: placesPrompt.slice(0, 280),
      };
      const pass = out.strippedHasRestaurantPref === false
        && out.strippedDietary[0] === "Vegan"
        && out.placesPromptHasRankingRole
        && out.placesPromptHasSeg;
      record("L3", "Compressed context replaces prose / ranking role", pass, out);
      expect(pass).toBe(true);
    });
  });

  // ─── Layer 4 ───────────────────────────────────────────────────────────
  describe("Layer 4 — contextual awareness + rejections", () => {
    beforeEach(() => {
      // Fresh module cache for EIA between tests isn't available; mock fetch and
      // use unique request patterns. Clear by reassigning fetch only.
    });

    it("weather/heat scoring prefers indoor over outdoor overlook", () => {
      const weather = {
        temperatureF: 104,
        condition: "Hot",
        precipitationChance: 5,
        severeWarnings: [{ type: "Excessive Heat Warning" }],
      };
      const weatherClass = classifyWeatherSeverity(weather);
      const outdoor = weatherScoreAdjustment(
        { name: "Desert Overlook", types: ["park", "tourist_attraction"] },
        weatherClass,
      );
      const indoor = weatherScoreAdjustment(
        { name: "Adobe Cafe", types: ["restaurant", "cafe"] },
        weatherClass,
      );
      const ranked = applyContextToPlaceList(
        [
          { name: "Desert Overlook", types: ["park"], rating: 4.9 },
          { name: "Adobe Cafe", types: ["restaurant", "cafe"], rating: 4.2 },
        ],
        { weather, arrival: new Date(), lat: 32.8 },
      );
      const out = {
        weatherClass,
        outdoor,
        indoor,
        rankedNames: ranked.map((p) => p.name),
        topNotes: ranked[0]?.contextNotes,
      };
      const pass = weatherClass.flags.includes("heat")
        && outdoor.delta < 0
        && indoor.delta > 0
        && ranked[0].name === "Adobe Cafe";
      record("L4", "Weather/heat scoring", pass, out);
      expect(pass).toBe(true);
    });

    it("opening-hours gating drops closed; keeps unknown", () => {
      const arrival = new Date();
      const day = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][arrival.getDay()];
      const pool = [
        { name: "Closed Now Diner", hours: `${day}: Closed`, rating: 4.8 },
        { name: "Unknown Hours Cafe", rating: 4.0 },
        { name: "Open All Day", hours: `${day}: 6:00 AM – 10:00 PM`, rating: 4.3 },
      ];
      const unknownKept = isLikelyOpenAtArrival(pool[1], arrival);
      const closedDropped = isLikelyOpenAtArrival(pool[0], arrival);
      const ranked = applyContextToPlaceList(pool, { arrival, lat: 32.8, minKeep: 1 });
      const out = {
        unknownKept,
        closedDropped,
        rankedNames: ranked.map((p) => p.name),
      };
      const pass = unknownKept === true
        && closedDropped === false
        && out.rankedNames.includes("Unknown Hours Cafe")
        && !out.rankedNames.includes("Closed Now Diner");
      record("L4", "Opening-hours gating + unknown retention", pass, out);
      expect(pass).toBe(true);
    });

    it("daylight-aware sequencing soft-drops night outdoor", () => {
      const nightArrival = new Date("2026-07-22T22:30:00");
      const adj = daylightScoreAdjustment(
        { name: "Canyon Overlook", types: ["park"] },
        nightArrival,
        32.8,
      );
      const ranked = applyContextToPlaceList(
        [
          { name: "Canyon Overlook", types: ["park"], rating: 4.9 },
          { name: "Night Diner", types: ["restaurant"], rating: 4.0 },
        ],
        { arrival: nightArrival, lat: 32.8 },
      );
      const out = { adj, rankedNames: ranked.map((p) => p.name) };
      const pass = adj.delta < 0 && ranked[0].name === "Night Diner";
      record("L4", "Daylight-aware sequencing", pass, out);
      expect(pass).toBe(true);
    });

    it("regional fuel-price weighting via captured EIA fixtures (mocked fetch)", async () => {
      vi.resetModules();
      globalThis.fetch = vi.fn(async (url) => {
        const u = String(url);
        if (!u.includes("api.eia.gov")) {
          throw new Error(`Unexpected live URL in zero-cost pass: ${u}`);
        }
        let duoarea = "NUS";
        for (const code of ["R30", "R40", "R10", "R20", "R50", "NUS"]) {
          if (u.includes(`duoarea%5D%5B%5D=${code}`) || u.includes(`duoarea][]=${code}`)) {
            duoarea = code;
            break;
          }
        }
        // URLSearchParams encodes as facets%5Bduoarea%5D%5B%5D=R30
        const m = u.match(/facets%5Bduoarea%5D%5B%5D=([A-Z0-9]+)/i)
          || u.match(/facets\[duoarea\]\[\]=([A-Z0-9]+)/i);
        if (m) duoarea = m[1];
        return {
          ok: true,
          json: async () => eiaJsonForDuoarea(duoarea),
        };
      });

      const { fetchRegionalPricesForPoints: fetchPrices } = await import("../../server/lib/eiaFuelPrices.js");
      const points = [
        { id: "seg-0", lat: 32.7767, lng: -96.797 }, // R30
        { id: "seg-4", lat: 31.7619, lng: -106.485 }, // R40
      ];
      expect(paddFromCoords(points[0].lat, points[0].lng)).toBe("R30");
      expect(paddFromCoords(points[1].lat, points[1].lng)).toBe("R40");

      const pricesById = await fetchPrices(points);
      const fill = fuelPreferFill(
        pricesById["seg-0"].regular,
        [pricesById["seg-0"].regular, pricesById["seg-4"].regular],
      );
      const segs = buildSegmentContexts({
        corridor: [
          { lat: points[0].lat, lng: points[0].lng },
          { lat: points[1].lat, lng: points[1].lng },
        ],
        fuelByKey: {
          "seg-0": pricesById["seg-0"],
          "seg-1": pricesById["seg-4"],
        },
        weatherByKey: {},
        departure: new Date("2026-07-22T08:00:00"),
        totalHours: 9,
        totalMiles: 640,
      });
      const lines = segs.map((s, i) => formatSegmentContextLine(s, i));
      const block = formatSegmentContextBlock(segs);
      const out = {
        padd: { dallas: "R30", elPaso: "R40" },
        prices: {
          "seg-0": pricesById["seg-0"]?.regularPrice,
          "seg-4": pricesById["seg-4"]?.regularPrice,
        },
        expectedFixture: {
          R30: formatGalPrice(EIA_FIXTURE.R30.parsed.regular),
          R40: formatGalPrice(EIA_FIXTURE.R40.parsed.regular),
        },
        fill,
        segLines: lines,
        blockHead: block.split("\n")[0],
        fetchCalls: globalThis.fetch.mock.calls.length,
      };
      const pass = pricesById["seg-0"]?.regularPrice === formatGalPrice(EIA_FIXTURE.R30.parsed.regular)
        && pricesById["seg-4"]?.regularPrice === formatGalPrice(EIA_FIXTURE.R40.parsed.regular)
        && lines.every((l) => /fuel\$/.test(l))
        && fill.preferFill === true
        && globalThis.fetch.mock.calls.every((c) => String(c[0]).includes("api.eia.gov"));
      record("L4", "Regional fuel$ from EIA fixtures", pass, out);
      expect(pass).toBe(true);
    });

    it("missing-data degradation still emits SEG without fuel$", async () => {
      globalThis.fetch = vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("api.eia.gov") || u.includes("api.openai") || u.includes("googleapis") || u.includes("hereapi")) {
          throw new Error(`Blocked live call: ${u}`);
        }
        if (u.includes("/api/weather")) {
          return { ok: true, json: async () => ({ weatherByCity: {}, severeAlerts: [] }) };
        }
        if (u.includes("/api/fuel-stations")) {
          return { ok: true, json: async () => ({ pricesById: {} }) };
        }
        throw new Error(`Unexpected URL: ${u}`);
      });

      const outCtx = await applySegmentContextToPlaces(
        {
          corridor: [{ lat: 32.8, lng: -96.8, restaurants: [{ name: "Cafe", types: ["restaurant"] }], gasStations: [] }],
          cities: [],
          boundary: { totalMiles: 50, samples: [] },
        },
        { duration: "1 hour" },
        { departureTime: new Date("2026-07-22T12:00:00") },
      );
      const out = {
        hasSeg: /SEG1/.test(outCtx.segmentContextPrompt || ""),
        hasFuelTag: /fuel\$/.test(outCtx.segmentContextPrompt || ""),
        prompt: outCtx.segmentContextPrompt,
        restaurant: outCtx.corridor[0].restaurants[0].name,
      };
      const pass = out.hasSeg && !out.hasFuelTag && out.restaurant === "Cafe";
      record("L4", "Missing-data degradation", pass, out);
      expect(pass).toBe(true);
    });

    it("stop removal + card hide write tagged rejections into plan_preferences shape", async () => {
      vi.useFakeTimers();
      const puts = [];
      globalThis.fetch = vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes("api.eia.gov") || u.includes("googleapis") || u.includes("hereapi") || u.includes("anthropic")) {
          throw new Error(`Blocked live call: ${u}`);
        }
        if (u.includes("/api/plan-preferences") && (!init?.method || init.method === "GET")) {
          return {
            ok: true,
            json: async () => ({ preferences: { meta: {} }, meta: {} }),
          };
        }
        if (u.includes("/api/plan-preferences") && init?.method === "PUT") {
          const body = JSON.parse(init.body);
          puts.push(body);
          return {
            ok: true,
            json: async () => ({
              preferences: body.preferences,
              meta: body.meta,
            }),
          };
        }
        throw new Error(`Unexpected URL: ${u} method=${init?.method}`);
      });

      const remove = describeStopRejection(
        { name: "Texas Steakhouse", category: "restaurant" },
        "restaurant",
        REJECTION_SOURCE.itinerary_remove,
      );
      const hide = describeStopRejection(
        { name: "Canyon Overlook", category: "scenic" },
        "road",
        REJECTION_SOURCE.card_hide,
      );

      let merged = mergeStopRejection(null, { name: "Texas Steakhouse" }, "restaurant", REJECTION_SOURCE.itinerary_remove);
      merged = mergeStopRejection(merged, { name: "Canyon Overlook", category: "scenic" }, "road", REJECTION_SOURCE.card_hide);
      const sanitized = sanitizeStopRejections(merged);

      scheduleStopRejection("tok", { name: "Texas Steakhouse", id: "s1" }, {
        kind: "restaurant",
        source: REJECTION_SOURCE.itinerary_remove,
      });
      scheduleStopRejection("tok", { name: "Canyon Overlook", id: "s2", category: "scenic" }, {
        kind: "road",
        source: REJECTION_SOURCE.card_hide,
      });
      expect(pendingStopRejectionCount()).toBe(2);
      await vi.advanceTimersByTimeAsync(REJECTION_UNDO_DELAY_MS + 50);

      const bySource = { itinerary_remove: { categories: {}, types: {} }, card_hide: { categories: {}, types: {} } };
      for (const p of puts) {
        const sr = p.meta?.stop_rejections;
        if (!sr?.by_source) continue;
        for (const src of ["itinerary_remove", "card_hide"]) {
          for (const [k, v] of Object.entries(sr.by_source[src]?.categories || {})) {
            bySource[src].categories[k] = v;
          }
          for (const [k, v] of Object.entries(sr.by_source[src]?.types || {})) {
            bySource[src].types[k] = v;
          }
        }
      }

      const out = {
        remove,
        hide,
        sanitized,
        putsCount: puts.length,
        combinedBySource: bySource,
        lastMeta: puts.at(-1)?.meta?.stop_rejections || null,
      };

      const pass = remove.source === "itinerary_remove"
        && hide.source === "card_hide"
        && sanitized.by_source.itinerary_remove.categories.restaurant >= 1
        && sanitized.by_source.card_hide.categories.attraction >= 1
        && puts.length >= 2
        && bySource.itinerary_remove.categories.restaurant >= 1
        && bySource.card_hide.categories.attraction >= 1;
      record("L4", "Rejection writes tagged (remove + hide)", pass, out);
      expect(pass).toBe(true);
    });
  });
});
