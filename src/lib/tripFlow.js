import {
  isTruckVehicle,
  isRvVehicle,
  applyAssumedVehicleSpecs,
} from "./vehicles.js";
import { parseMilesFromDistance } from "./parsing.js";
import { callHaiku } from "./apiClient.js";

export const FLOW_QUESTION_IDS = ["vehicle", "travelers", "lodging", "preferences"];

export const VEHICLE_GROUPS = [
  {
    label: "Personal",
    options: [
      { value: "Car", label: "Car" },
      { value: "Motorcycle", label: "Motorcycle" },
      { value: "SUV or Van", label: "SUV or Van" },
    ],
  },
  {
    label: "Oversized",
    options: [
      { value: "RV", label: "RV" },
      { value: "Camper Van", label: "Camper Van" },
      { value: "Box Truck", label: "Box Truck" },
    ],
  },
  {
    label: "Commercial",
    options: [
      { value: "Semi Truck (18-wheeler)", label: "Semi Truck 18-Wheeler" },
      { value: "Flatbed", label: "Flatbed" },
      { value: "Tanker", label: "Tanker" },
    ],
  },
  {
    label: "Other",
    options: [
      { value: "Boat", label: "Boat" },
      { value: "Ferry", label: "Ferry" },
      { value: "Plane", label: "Plane" },
    ],
  },
];

export const VEHICLE_CHOICES = VEHICLE_GROUPS.flatMap(g => g.options.map(o => o.value));

/** @deprecated Kept for imports — specs are assumed automatically. */
export const TRUCK_HEIGHTS = [];
export const RV_HEIGHTS = [];
export const TRUCK_WEIGHTS = [];
export const RV_WEIGHTS = [];
export const KIDS_AGE_CHOICES = [];

const MAX_HAIKU_QUESTIONS = 4;
const DAY_TRIP_MILES = 150;

export const TRUCKER_QUESTION_SEQUENCE = [
  {
    id: "hauling_type",
    ask: "What are you hauling?",
    type: "choice",
    choices: ["General Freight", "Refrigerated Load", "Flatbed", "Tanker", "Livestock", "Empty"],
  },
  {
    id: "sleeper_cab",
    ask: "Do you have a sleeper cab?",
    type: "choice",
    choices: ["Yes sleeper cab", "No I need a motel or hotel"],
  },
  {
    id: "route_restrictions",
    ask: "Any route restrictions?",
    type: "multiselect",
    choices: ["Avoid toll roads", "Avoid low bridges", "Avoid certain states", "No restrictions"],
  },
  {
    id: "truck_stop_brand",
    ask: "Preferred truck stop brand?",
    type: "choice",
    choices: ["Pilot Flying J", "Love's", "Petro", "TA Travel Center", "No preference"],
  },
];

export function hasKidsToddlers(kidsAges) {
  return kidsAges === "Toddlers" || kidsAges === "Mix of ages";
}

export function getRouteDistanceMiles(context) {
  if (context?.routeDistanceMiles != null) return context.routeDistanceMiles;
  return parseMilesFromDistance(context?.routeDistance);
}

export function isDayTripByDistance(context) {
  const miles = getRouteDistanceMiles(context);
  return miles != null && miles < DAY_TRIP_MILES;
}

function mapTruckerAnswers(answers) {
  const out = { ...answers };

  if (out.sleeper_cab?.startsWith("Yes")) {
    out.lodging = "Sleeper cab — no hotel needed";
  } else if (out.sleeper_cab?.startsWith("No")) {
    out.lodging = "Motel near truck stop";
  }

  const prefs = Array.isArray(out.preferences) ? [...out.preferences] : [];
  const restrictions = Array.isArray(out.route_restrictions) ? out.route_restrictions : [];
  restrictions.forEach(r => {
    if (r === "Avoid toll roads" && !prefs.includes("Avoid tolls")) prefs.push("Avoid tolls");
    if (r === "Avoid low bridges" && !prefs.includes("Low bridge warnings")) prefs.push("Low bridge warnings");
    if (r === "Avoid certain states" && !prefs.includes("Avoid steep grades")) prefs.push("Avoid steep grades");
  });
  if (restrictions.includes("No restrictions") && restrictions.length === 1) {
    // no extra prefs
  }

  if (out.truck_stop_brand && out.truck_stop_brand !== "No preference") {
    if (!prefs.includes("Fuel stops (Pilot/Flying J/Love's/TA)")) {
      prefs.push("Fuel stops (Pilot/Flying J/Love's/TA)");
    }
    out.truck_stop_preference = out.truck_stop_brand;
  }

  if (out.hauling_type === "Tanker" && out.truck_hazmat === "No") {
    out.hauling_note = "Tanker load — verify hazmat requirements if applicable";
  }

  out.preferences = prefs;
  return out;
}

export function normalizeTripAnswers(answers, context = {}) {
  let out = applyAssumedVehicleSpecs({ ...answers });
  const miles = getRouteDistanceMiles(context);
  if (miles != null) {
    out.trip_type = miles < DAY_TRIP_MILES ? "Day trip" : (out.trip_type || "Road trip");
  } else if (!out.trip_type) {
    out.trip_type = "Road trip";
  }
  if (!Array.isArray(out.preferences)) {
    out.preferences = out.preferences ? [out.preferences] : [];
  }
  if (isDayTripByDistance(context)) {
    delete out.lodging;
  }
  if (isTruckVehicle(out.vehicle)) {
    out = mapTruckerAnswers(out);
  }
  return out;
}

function buildVehicleQuestion() {
  return {
    done: false,
    id: "vehicle",
    ask: "What are you traveling in?",
    type: "vehicle",
    groups: VEHICLE_GROUPS,
    choices: VEHICLE_CHOICES,
  };
}

function getNextTruckerQuestion(answers) {
  for (const q of TRUCKER_QUESTION_SEQUENCE) {
    if (answers[q.id] === undefined) return { done: false, ...q };
  }
  return { done: true };
}

function isTruckerQuestionComplete(id, answers) {
  if (answers[id] === undefined) return false;
  if (id === "route_restrictions") return Array.isArray(answers.route_restrictions);
  return true;
}

function isHaikuQuestionComplete(id, answers) {
  if (answers[id] === undefined) return false;
  if (Array.isArray(answers[id])) return true;
  return answers[id] !== "";
}

function isLocationQuestion(question) {
  if (!question || question.done) return false;
  const blob = `${question.id} ${question.ask} ${(question.choices || []).join(" ")}`.toLowerCase();
  return /origin|destination|starting point|start from|starting from|where are you|departure|arrival city|leave from|going to|location|pickup city|drop.?off/.test(blob);
}

function sanitizeHaikuQuestion(raw) {
  if (!raw || raw.done) return { done: true };

  const id = String(raw.id || "question").trim();
  const type = ["choice", "multiselect", "vehicle"].includes(raw.type) ? raw.type : "choice";
  const ask = String(raw.ask || "One more detail for your trip.").trim();
  let choices = Array.isArray(raw.choices) ? raw.choices.map(String).filter(Boolean) : [];

  if (type === "multiselect") {
    if (choices.length < 2) choices = ["No preference", "Skip"];
  } else if (choices.length < 3) {
    choices = choices.length ? choices : ["Yes", "No", "Not sure"];
    while (choices.length < 3) choices.push(`Option ${choices.length + 1}`);
  }
  choices = choices.slice(0, 6);

  return { done: false, id, ask, type, choices };
}

function parseHaikuQuestion(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  return sanitizeHaikuQuestion(parsed);
}

function formatAnswersForPrompt(answers) {
  return Object.entries(answers)
    .filter(([k, v]) => !k.startsWith("_") && v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n") || "(none yet)";
}

function buildHaikuPrompt(answers, context) {
  const vehicle = answers.vehicle || context.vehicle || "Car";
  const miles = getRouteDistanceMiles(context);
  const distanceLabel = context.routeDistance || (miles != null ? `${Math.round(miles)} mi` : "unknown");
  const dayTrip = isDayTripByDistance(context);
  const haikuCount = context.haikuQuestionCount ?? 0;
  const rv = isRvVehicle(vehicle);
  const carLike = !isTruckVehicle(vehicle) && !rv;

  const origin = context.origin || "unknown";
  const destination = context.destination || "unknown";

  return `You are TripMappa's travel planning assistant. Return the SINGLE best next question for this trip.

TRIP CONTEXT:
- Origin: ${origin}
- Destination: ${destination}
- Vehicle: ${vehicle}
- Route distance: ${distanceLabel}${miles != null ? ` (${Math.round(miles)} miles)` : ""}
- Day trip (under 150 mi): ${miles != null ? (dayTrip ? "YES — do NOT ask about overnight lodging" : "NO — lodging questions OK if needed") : "UNKNOWN — do not ask lodging until distance is known"}
- Assumed specs (already applied — NEVER ask for height, weight, hazmat, or towing): ${
    isTruckVehicle(vehicle) ? "13'6\" (or 14' oversized), 80,000 lbs, diesel, no hazmat" :
    rv ? "11' height, 12,000 lbs, no towing" : "standard passenger vehicle"
  }
- Questions asked so far: ${haikuCount} of ${MAX_HAIKU_QUESTIONS} max

RULES:
- Return 3–6 short, trip-specific answer choices in "choices" — fully tailored to this vehicle and distance.
- NEVER ask fuel type for trucks (diesel is assumed) or obvious parking for 18-wheelers.
- NEVER ask lodging on day trips (under 150 miles).
- NEVER repeat answered topics. Only ask if the answer would meaningfully change the trip plan.
- ONLY ask questions whose answers would meaningfully change the route, stop cities, lodging recommendations, or trip duration. Never ask about skill level, experience, or anything that would not affect those four things.
- NEVER ask the user for their origin, destination, starting point, or any location information — that has already been provided.
- Skip anything inferable from vehicle or distance.
- If nothing useful remains, return {"done": true}.

${carLike ? "Car-like trip topics: travelers, lodging (150+ mi only), trip preferences." : ""}
${rv ? "RV trip topics: RV park/campground lodging (150+ mi), scenic routes, dump stations, propane, pet/kid stops." : ""}

Answers so far:
${formatAnswersForPrompt(answers)}

Respond with JSON only:
{
  "done": false,
  "id": "unique_snake_case_id",
  "ask": "Short question under 14 words",
  "type": "choice|multiselect",
  "choices": ["option1", "option2", "option3"]
}`;
}

export function getNextFlowQuestion(answers, context = {}) {
  const normalized = normalizeTripAnswers(answers, context);

  if (!normalized.vehicle) return buildVehicleQuestion();

  if (isTruckVehicle(normalized.vehicle)) {
    const truckQ = getNextTruckerQuestion(normalized);
    if (!truckQ.done) return truckQ;
    return { done: true };
  }

  const haikuCount = context.haikuQuestionCount ?? 0;
  if (haikuCount >= MAX_HAIKU_QUESTIONS) return { done: true };

  return {
    done: false,
    id: "preferences",
    ask: "Any preferences? Select all that apply.",
    type: "multiselect",
    choices: ["Scenic route", "Restaurant recommendations", "Pet-friendly stops", "Avoid tolls", "Avoid highways"],
  };
}

export function countFlowQuestionsAnswered(answers) {
  let n = 0;
  if (answers.vehicle) n += 1;
  if (isTruckVehicle(answers.vehicle)) {
    TRUCKER_QUESTION_SEQUENCE.forEach(q => {
      if (isTruckerQuestionComplete(q.id, answers)) n += 1;
    });
    return Math.min(n, 5);
  }
  Object.keys(answers).forEach(k => {
    if (k !== "vehicle" && k !== "trip_type" && k !== "fuel" && !k.startsWith("truck_") && !k.startsWith("rv_")) {
      if (answers[k] !== undefined && answers[k] !== "") n += 1;
    }
  });
  return n;
}

export function pruneSkippedAnswers(answers) {
  return normalizeTripAnswers(answers);
}

export function flowQuestionSkipped() {
  return false;
}

export function countApplicableFlowQuestions() {
  return MAX_HAIKU_QUESTIONS + 1;
}

export function isFlowQuestionComplete(id, answers) {
  if (id === "vehicle") return !!answers.vehicle;
  if (isTruckVehicle(answers.vehicle)) return isTruckerQuestionComplete(id, answers);
  return isHaikuQuestionComplete(id, answers);
}

export function buildFlowQuestion(id, answers, context = {}) {
  if (id === "vehicle") return buildVehicleQuestion();
  return getNextFlowQuestion(answers, context);
}

export async function fetchNextQuestion(answers, context = {}) {
  const normalized = normalizeTripAnswers(answers, context);

  if (!normalized.vehicle) return buildVehicleQuestion();

  if (isTruckVehicle(normalized.vehicle)) {
    const truckQ = getNextTruckerQuestion(normalized);
    return truckQ.done ? { done: true } : truckQ;
  }

  const haikuCount = context.haikuQuestionCount ?? 0;
  if (haikuCount >= MAX_HAIKU_QUESTIONS) return { done: true };

  try {
    const text = await callHaiku(buildHaikuPrompt(normalized, context));
    const question = parseHaikuQuestion(text);
    if (question.done) return { done: true };

    if (isLocationQuestion(question)) {
      if (haikuCount + 1 >= MAX_HAIKU_QUESTIONS) return { done: true };
      const retry = await callHaiku(buildHaikuPrompt(normalized, { ...context, haikuQuestionCount: haikuCount + 1 }));
      const retried = parseHaikuQuestion(retry);
      if (retried.done || isLocationQuestion(retried)) return getNextFlowQuestion(normalized, context);
      return retried;
    }

    if (isHaikuQuestionComplete(question.id, normalized)) {
      if (haikuCount + 1 >= MAX_HAIKU_QUESTIONS) return { done: true };
      const retry = await callHaiku(buildHaikuPrompt(normalized, { ...context, haikuQuestionCount: haikuCount + 1 }));
      return parseHaikuQuestion(retry);
    }

    if (question.id === "lodging" && isDayTripByDistance(context)) {
      return fetchNextQuestion(
        { ...normalized, lodging: "No overnight stay" },
        { ...context, haikuQuestionCount: haikuCount + 1 },
      );
    }

    return question;
  } catch (err) {
    console.error("Haiku question routing failed, using local fallback:", err);
    return getNextFlowQuestion(normalized, context);
  }
}
