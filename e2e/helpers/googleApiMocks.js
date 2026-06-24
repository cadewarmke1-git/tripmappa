import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "google");

/** 1×1 transparent PNG */
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hRingAAAABJRU5ErkJggg==",
  "base64",
);

const GOOGLE_HOSTS = [
  "maps.googleapis.com",
  "maps.gstatic.com",
  "streetviewpixels-pa.googleapis.com",
  "weather.googleapis.com",
  "places.googleapis.com",
];

function isGoogleMapsApiUrl(urlString) {
  try {
    const { hostname } = new URL(urlString);
    return GOOGLE_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
}

function loadMapsStub() {
  return fs.readFileSync(path.join(FIXTURES_DIR, "maps-api-stub.js"), "utf8");
}

function pickFixture(url) {
  const lower = url.toLowerCase();
  if (lower.includes("/maps/api/js")) return "maps-js";
  if (lower.includes("/maps/api/geocode/")) return "geocode.json";
  if (lower.includes("/maps/api/directions/")) return "directions.json";
  if (lower.includes("/maps/api/place/nearbysearch/")) return "places-nearby.json";
  if (lower.includes("/maps/api/place/details/")) return "place-details.json";
  if (lower.includes("/maps/api/place/autocomplete/")) return "place-autocomplete.json";
  if (lower.includes("/maps/api/place/findplacefromtext/")) return "place-autocomplete.json";
  if (lower.includes("/maps/api/place/photo")) return "photo";
  if (lower.includes("/maps/vt") || lower.includes("maps.gstatic.com")) return "tile";
  if (lower.includes("/$rpc/") || lower.includes("mapsjs")) return "rpc";
  if (lower.includes("weather.googleapis.com")) return "weather";
  return "generic";
}

/**
 * Intercept browser requests to Google Maps / Places / Geocoding / Directions APIs.
 * TripMappa backend routes (/api/plan-trip, etc.) are not mocked.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ track?: boolean }} [options]
 */
export async function installGoogleApiMocks(page, options = {}) {
  const track = options.track !== false;
  const stats = {
    intercepted: 0,
    byKind: {},
    urls: [],
    leaked: [],
  };

  const mapsStub = loadMapsStub();
  const geocode = loadFixture("geocode.json");
  const directions = loadFixture("directions.json");
  const placesNearby = loadFixture("places-nearby.json");
  const placeDetails = loadFixture("place-details.json");
  const placeAutocomplete = loadFixture("place-autocomplete.json");

  async function fulfillGoogle(route) {
    const url = route.request().url();
    if (track) stats.urls.push(url);

    const kind = pickFixture(url);
    stats.byKind[kind] = (stats.byKind[kind] || 0) + 1;
    stats.intercepted += 1;

    if (kind === "maps-js") {
      let body = mapsStub;
      const parsed = new URL(url);
      const callback = parsed.searchParams.get("callback");
      if (callback && !callback.includes("__ib__")) {
        body += `\n;if(typeof ${callback}==="function"){${callback}();}`;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=UTF-8",
        body,
      });
      return;
    }

    if (kind === "geocode.json") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(geocode) });
      return;
    }

    if (kind === "directions.json") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(directions) });
      return;
    }

    if (kind === "places-nearby.json") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(placesNearby) });
      return;
    }

    if (kind === "place-details.json") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(placeDetails) });
      return;
    }

    if (kind === "place-autocomplete.json") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(placeAutocomplete) });
      return;
    }

    if (kind === "photo" || kind === "tile") {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: TRANSPARENT_PNG,
      });
      return;
    }

    if (kind === "weather") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ currentConditions: { temperature: { value: 72, unit: "FAHRENHEIT" } } }),
      });
      return;
    }

    // RPC / unknown Google Maps endpoints — empty success so nothing reaches Google
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  }

  const handler = async (route) => {
    if (!isGoogleMapsApiUrl(route.request().url())) {
      await route.continue();
      return;
    }
    try {
      await fulfillGoogle(route);
    } catch (err) {
      stats.leaked.push({ url: route.request().url(), error: String(err.message || err) });
      await route.abort("failed").catch(() => {});
    }
  };

  await page.route("**://maps.googleapis.com/**", handler);
  await page.route("**://maps.gstatic.com/**", handler);
  await page.route("**://streetviewpixels-pa.googleapis.com/**", handler);
  await page.route("**://weather.googleapis.com/**", handler);
  await page.route("**://places.googleapis.com/**", handler);

  page.on("request", (req) => {
    const url = req.url();
    if (!isGoogleMapsApiUrl(url)) return;
    // If a Google request is not fulfilled by our routes, it would still appear here as pending.
    // We rely on route handlers above; post-run we compare requestFinished vs intercepted counts.
  });

  return {
    getStats: () => ({ ...stats, urls: [...stats.urls] }),
    assertNoLeakedRequests(requestLog = stats.urls) {
      const leaked = requestLog.filter(url => isGoogleMapsApiUrl(url));
      if (stats.leaked.length > 0) {
        throw new Error(`Google mock errors: ${JSON.stringify(stats.leaked)}`);
      }
      if (leaked.length === 0 && stats.intercepted === 0) {
        throw new Error("No Google API requests were intercepted — mocks may not be installed.");
      }
      return { intercepted: stats.intercepted, googleUrls: leaked.length, byKind: stats.byKind };
    },
  };
}

export { isGoogleMapsApiUrl, GOOGLE_HOSTS };
