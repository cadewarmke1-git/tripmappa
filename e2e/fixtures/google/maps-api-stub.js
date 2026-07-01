/**
 * Minimal Google Maps JavaScript API stub for Playwright tests.
 * Patches google.maps in place so @googlemaps/js-api-loader bootstrap keeps working.
 */
(function () {
  "use strict";

  function latLng(lat, lng) {
    const la = Number(lat);
    const ln = Number(lng);
    return {
      lat: () => la,
      lng: () => ln,
      toJSON: () => ({ lat: la, lng: ln }),
      equals(other) {
        return other && other.lat() === la && other.lng() === ln;
      },
    };
  }

  function decodePath() {
    return [
      latLng(32.7766642, -96.7969879),
      latLng(31.549333, -97.1466695),
      latLng(30.2, -95.9),
      latLng(29.7604267, -95.3698028),
    ];
  }

  const MOCK_PLACES = [
    {
      place_id: "mock-place-riverwalk-grill",
      name: "Mock Riverwalk Grill",
      vicinity: "100 Mock Riverwalk, Waco",
      rating: 4.6,
      user_ratings_total: 842,
      types: ["restaurant", "food"],
      geometry: { location: latLng(31.5493, -97.1467) },
      photos: [{
        height: 800,
        width: 1200,
        getUrl: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      }],
    },
    {
      place_id: "mock-place-magnolia-cafe",
      name: "Mock Magnolia Market Cafe",
      vicinity: "601 Mock Webster Ave, Waco",
      rating: 4.4,
      user_ratings_total: 1203,
      types: ["cafe", "restaurant"],
      geometry: { location: latLng(31.5512, -97.1421) },
      photos: [{
        height: 600,
        width: 900,
        getUrl: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      }],
    },
    {
      place_id: "mock-place-brazos-diner",
      name: "Mock Brazos Diner",
      vicinity: "220 Mock Brazos St, Waco",
      rating: 4.2,
      user_ratings_total: 516,
      types: ["restaurant"],
      geometry: { location: latLng(31.5478, -97.1502) },
      photos: [{
        height: 720,
        width: 1080,
        getUrl: () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      }],
    },
  ];

  function geocodeResult(address) {
    const text = String(address || "").toLowerCase();
    const isHouston = text.includes("houston");
    const isAustin = text.includes("austin");
    const coords = isHouston
      ? latLng(29.7604267, -95.3698028)
      : isAustin
        ? latLng(30.267153, -97.743057)
        : latLng(32.7766642, -96.7969879);
    const label = isHouston ? "Houston, TX, USA" : isAustin ? "Austin, TX, USA" : "Dallas, TX, USA";
    return {
      formatted_address: label,
      geometry: { location: coords, viewport: { northeast: coords, southwest: coords } },
      place_id: isHouston ? "mock-geocode-houston" : isAustin ? "mock-geocode-austin" : "mock-geocode-dallas",
      types: ["locality"],
    };
  }

  function buildDirectionsResult(request) {
    const originText = typeof request.origin === "string" ? request.origin : "Dallas, TX";
    const destText = typeof request.destination === "string" ? request.destination : "Houston, TX";
    const start = geocodeResult(originText).geometry.location;
    const end = geocodeResult(destText).geometry.location;
    const path = decodePath();
    return {
      routes: [{
        legs: [{
          distance: { text: "239 mi", value: 384633 },
          duration: { text: "3 hours 30 mins", value: 12600 },
          duration_in_traffic: { text: "3 hours 45 mins", value: 13500 },
          start_address: geocodeResult(originText).formatted_address,
          end_address: geocodeResult(destText).formatted_address,
          start_location: start,
          end_location: end,
          steps: [
            {
              distance: { text: "120 mi", value: 193121 },
              duration: { text: "1 hour 45 mins", value: 6300 },
              start_location: start,
              end_location: latLng(31.549333, -97.1466695),
              end_address: "Waco, TX, USA",
            },
            {
              distance: { text: "119 mi", value: 191512 },
              duration: { text: "1 hour 45 mins", value: 6300 },
              start_location: latLng(31.549333, -97.1466695),
              end_location: end,
              end_address: geocodeResult(destText).formatted_address,
            },
          ],
        }],
        overview_path: path,
        warnings: [],
      }],
    };
  }

  class Map {
    constructor(_el, _opts) {
      this._opts = _opts || {};
    }
    fitBounds() {}
    panTo() {}
    setCenter() {}
    setZoom() {}
    setMapTypeId() {}
    setOptions(opts) {
      this._opts = { ...this._opts, ...opts };
    }
    getBounds() {
      return {
        getNorthEast: () => latLng(33, -95),
        getSouthWest: () => latLng(29, -97),
      };
    }
  }

  class Marker {
    constructor(opts) {
      this._map = opts?.map || null;
      this._title = opts?.title || "";
      this._click = opts?.click || null;
    }
    setMap(map) { this._map = map; }
    setPosition() {}
    setIcon() {}
    addListener(event, fn) {
      if (event === "click") this._click = fn;
      return { remove() {} };
    }
  }

  class DirectionsRenderer {
    constructor(opts = {}) {
      this._map = opts?.map || null;
      this._directions = null;
    }
    setMap(map) { this._map = map; }
    setDirections(directions) { this._directions = directions; }
    setOptions() {}
  }

  class Polyline {
    constructor(opts) { this._map = opts?.map || null; }
    setMap(map) { this._map = map; }
    setPath() {}
    setOptions() {}
  }

  class Polygon {
    constructor(opts) { this._paths = opts?.paths || []; }
  }

  class Autocomplete {
    constructor(input) {
      this.input = input;
      this._listeners = {};
    }
    addListener(event, fn) {
      this._listeners[event] = fn;
      return { remove: () => { delete this._listeners[event]; } };
    }
    getPlace() {
      const value = this.input?.value || "Dallas, TX";
      return {
        formatted_address: value,
        name: value,
        geometry: { location: geocodeResult(value).geometry.location },
        place_id: geocodeResult(value).place_id,
      };
    }
    setFields() {}
    setBounds() {}
    setComponentRestrictions() {}
    setOptions() {}
  }

  class PlacesService {
    constructor(_container) {}
    nearbySearch(_req, cb) {
      setTimeout(() => cb(MOCK_PLACES.slice(), "OK", { hasNextPage: false }), 0);
    }
    textSearch(_req, cb) {
      setTimeout(() => cb(MOCK_PLACES.slice(), "OK"), 0);
    }
    getDetails(req, cb) {
      const hit = MOCK_PLACES.find(p => p.place_id === req.placeId) || MOCK_PLACES[0];
      setTimeout(() => cb({ ...hit, formatted_address: hit.vicinity, geometry: hit.geometry }, "OK"), 0);
    }
  }

  class AutocompleteService {
    getPlacePredictions(req, cb) {
      const input = String(req?.input || "").toLowerCase();
      const preds = [
        { description: "Dallas, TX, USA", place_id: "mock-autocomplete-dallas", structured_formatting: { main_text: "Dallas", secondary_text: "TX, USA" } },
        { description: "Houston, TX, USA", place_id: "mock-autocomplete-houston", structured_formatting: { main_text: "Houston", secondary_text: "TX, USA" } },
        { description: "Austin, TX, USA", place_id: "mock-autocomplete-austin", structured_formatting: { main_text: "Austin", secondary_text: "TX, USA" } },
      ].filter(p => !input || p.description.toLowerCase().includes(input));
      setTimeout(() => cb(preds, "OK"), 0);
    }
  }

  class Geocoder {
    geocode(req, cb) {
      const address = typeof req === "string" ? req : req?.address || req?.location || "Dallas, TX";
      setTimeout(() => cb([geocodeResult(address)], "OK"), 0);
    }
  }

  class DirectionsService {
    route(req, cb) {
      setTimeout(() => cb(buildDirectionsResult(req), "OK"), 0);
    }
  }

  class LatLngBounds {
    constructor() { this._points = []; }
    extend(point) { this._points.push(point); }
    getNorthEast() { return this._points[0] || latLng(33, -95); }
    getSouthWest() { return this._points[this._points.length - 1] || latLng(29, -97); }
    isEmpty() { return this._points.length === 0; }
  }

  const libraryImpl = {
    core: {},
    maps: {},
    places: {},
    routes: {},
    geometry: {},
  };

  function patchMaps(maps) {
    maps.Map = Map;
    maps.Marker = Marker;
    maps.DirectionsRenderer = DirectionsRenderer;
    maps.Polyline = Polyline;
    maps.Polygon = Polygon;
    maps.LatLng = latLng;
    maps.LatLngBounds = LatLngBounds;
    maps.Geocoder = Geocoder;
    maps.DirectionsService = DirectionsService;
    maps.TravelMode = { DRIVING: "DRIVING", WALKING: "WALKING", BICYCLING: "BICYCLING", TRANSIT: "TRANSIT" };
    maps.TrafficModel = { BEST_GUESS: "bestguess", OPTIMISTIC: "optimistic", PESSIMISTIC: "pessimistic" };
    maps.MapTypeId = { ROADMAP: "roadmap", SATELLITE: "satellite", HYBRID: "hybrid", TERRAIN: "terrain" };
    maps.SymbolPath = { CIRCLE: 0, BACKWARD_CLOSED_ARROW: 1, FORWARD_CLOSED_ARROW: 2 };
    maps.Size = function Size(w, h) { this.width = w; this.height = h; };
    maps.Point = function Point(x, y) { this.x = x; this.y = y; };
    maps.version = maps.version || "mock-3.58.0";
    maps.event = maps.event || {
      addListener() { return { remove() {} }; },
      addListenerOnce(_t, _e, handler) { if (typeof handler === "function") setTimeout(handler, 0); return { remove() {} }; },
      removeListener() {},
      trigger() {},
    };
    maps.places = maps.places || {};
    maps.places.PlacesService = PlacesService;
    maps.places.AutocompleteService = AutocompleteService;
    maps.places.Autocomplete = Autocomplete;
    maps.places.PlacesServiceStatus = { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS", OVER_QUERY_LIMIT: "OVER_QUERY_LIMIT", REQUEST_DENIED: "REQUEST_DENIED", INVALID_REQUEST: "INVALID_REQUEST" };
    maps.geometry = maps.geometry || {};
    maps.geometry.spherical = {
      computeHeading(a, b) {
        return Math.atan2(b.lng() - a.lng(), b.lat() - a.lat()) * (180 / Math.PI);
      },
    };
    maps.geometry.poly = { containsLocation() { return true; } };

    libraryImpl.core = maps;
    libraryImpl.maps = maps;
    libraryImpl.places = maps.places;
    libraryImpl.routes = { Route: class Route {} };
    libraryImpl.geometry = maps.geometry;

    const bootstrapImport = maps.importLibrary;
    maps.importLibrary = async (name) => {
      if (libraryImpl[name]) return libraryImpl[name];
      if (typeof bootstrapImport === "function") {
        try {
          return await bootstrapImport.call(maps, name);
        } catch {
          return libraryImpl.maps;
        }
      }
      return libraryImpl.maps;
    };
  }

  window.google = window.google || {};
  window.google.maps = window.google.maps || {};
  patchMaps(window.google.maps);

  const ib = window.google.maps.__ib__;
  if (typeof ib === "function") {
    queueMicrotask(() => ib());
  }
})();
