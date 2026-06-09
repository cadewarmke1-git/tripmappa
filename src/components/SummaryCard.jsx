import { useState } from "react";
import {
  isTruckVehicle,
  isRvVehicle,
  isTruckerTrip,
  isRvTrip,
  isScenicRoute,
  inferFuelType,
  getEffectiveVehicle,
  formatPartySizeLabel,
  MULTI_VEHICLE_TRIP,
} from "../lib/vehicles.js";
import { isContinuousDrive } from "../lib/driveMode.js";
import { asArray } from "../lib/tripAccommodations.js";
import { getScheduleRestrictionLabels } from "../lib/scheduleRestrictions.js";
import { SUMMARY_EDIT_QUESTION_BY_ROW } from "../lib/tripFlow.js";

const PAYOFF_KEYS = ["Trip", "Vehicle", "Fuel", "Party size"];

const SUMMARY_SECTIONS = [
  {
    id: "trip",
    title: "Trip & vehicle",
    keys: new Set([
      "Trip", "Vehicle", "Primary vehicle", "Vehicles on trip", "Fuel", "Fuel type",
      "Hauling", "Sleeper cab", "Truck stops", "Assumed specs", "Assumed RV specs",
    ]),
  },
  {
    id: "route",
    title: "Route & party",
    keys: new Set(["Party size", "Drive mode", "Lodging", "Route restrictions", "Coordination"]),
  },
  {
    id: "prefs",
    title: "Preferences",
    keys: new Set(["Preferences", "Dietary", "Kids ages", "Schedule"]),
  },
];

function buildAllAnswerEditRows(historyIds, hasTripDetails) {
  const rows = [];
  if (historyIds.has("lodging")) {
    rows.push({ label: "Lodging preferences", qId: "lodging" });
  }
  if (hasTripDetails) {
    rows.push({ label: "Trip preferences", qId: "trip_details" });
    rows.push({ label: "Dietary restrictions", qId: "trip_details" });
  }
  if (historyIds.has("schedule_drive_hours")) {
    rows.push({ label: "Schedule", qId: "schedule_drive_hours" });
  } else if (hasTripDetails) {
    rows.push({ label: "Schedule", qId: "trip_details" });
  }
  if (historyIds.has("kids_ages")) {
    rows.push({ label: "Kids ages", qId: "kids_ages" });
  }
  if (historyIds.has("coordination_needs")) {
    rows.push({ label: "Coordination preferences", qId: "coordination_needs" });
  }
  return rows;
}

export default function SummaryCard({
  answers,
  hosCompliance,
  compactGrid = false,
  editable = false,
  questionHistory = [],
  onEditQuestion,
}) {
  const [allAnswersOpen, setAllAnswersOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => new Set(["trip", "route"]));
  const effective = getEffectiveVehicle(answers);
  const fuel = inferFuelType(effective, answers.preferences || [], answers);
  const rows = [
    answers.trip_type && ["Trip", answers.trip_type],
    answers.vehicle && ["Vehicle", answers.vehicle],
    answers.vehicle === MULTI_VEHICLE_TRIP && answers.primary_vehicle && ["Primary vehicle", answers.primary_vehicle],
    Array.isArray(answers.multi_vehicles) && answers.multi_vehicles.length > 0 && ["Vehicles on trip", answers.multi_vehicles.join(", ")],
    answers.fuel_type && ["Fuel", answers.fuel_type],
    isTruckVehicle(effective) && answers.hauling_type && ["Hauling", answers.hauling_type],
    isTruckVehicle(effective) && answers.sleeper_cab && ["Sleeper cab", answers.sleeper_cab],
    isTruckVehicle(effective) && answers.truck_stop_brand && ["Truck stops", answers.truck_stop_brand],
    isTruckVehicle(effective) && answers.truck_height && ["Assumed specs", `${answers.truck_height} · ${answers.truck_weight} · Diesel · HOS required`],
    isRvVehicle(effective) && answers.rv_height && ["Assumed RV specs", `${answers.rv_height} · ${answers.rv_weight}`],
    formatPartySizeLabel(answers.travelers) && ["Party size", formatPartySizeLabel(answers.travelers)],
    isContinuousDrive(answers) && ["Drive mode", "Drive straight through"],
    answers.lodging && !isContinuousDrive(answers) && ["Lodging", answers.lodging],
    Array.isArray(answers.route_restrictions) && answers.route_restrictions.length > 0 && ["Route restrictions", answers.route_restrictions.join(", ")],
    Array.isArray(answers.coordination_needs) && answers.coordination_needs.length > 0 && ["Coordination", answers.coordination_needs.join(", ")],
    Array.isArray(answers.preferences) && answers.preferences.length > 0 && ["Preferences", answers.preferences.join(", ")],
    !answers.fuel_type && fuel && ["Fuel type", fuel],
    asArray(answers.dietary).filter(d => d && d !== "No restrictions").length > 0
      && ["Dietary", asArray(answers.dietary).filter(d => d && d !== "No restrictions").join(", ")],
    asArray(answers.kids_ages).filter(Boolean).length > 0 && ["Kids ages", asArray(answers.kids_ages).join(", ")],
    getScheduleRestrictionLabels(answers).length > 0
      && ["Schedule", getScheduleRestrictionLabels(answers).join(", ")],
  ].filter(Boolean);

  const payoffRows = rows.filter(([k]) => PAYOFF_KEYS.includes(k));
  const showPayoffGrid = compactGrid && payoffRows.length > 0;
  const historyIds = new Set(questionHistory.map(h => h.question?.id).filter(Boolean));
  const hasTripDetails = historyIds.has("trip_details");
  const allAnswerEditRows = buildAllAnswerEditRows(historyIds, hasTripDetails);

  function canEditRow(rowKey) {
    if (!editable || !onEditQuestion) return false;
    const qId = SUMMARY_EDIT_QUESTION_BY_ROW[rowKey];
    if (qId) return historyIds.has(qId);
    return false;
  }

  function renderEditLink(rowKey) {
    const qId = SUMMARY_EDIT_QUESTION_BY_ROW[rowKey];
    if (!canEditRow(rowKey)) return null;
    return (
      <button
        type="button"
        className="summary-edit-link"
        onClick={() => onEditQuestion(qId)}
      >
        Edit
      </button>
    );
  }

  const useGroupedSections = !showPayoffGrid && rows.length > 5;
  const groupedRows = useGroupedSections
    ? SUMMARY_SECTIONS.map(section => ({
        ...section,
        items: rows.filter(([k]) => section.keys.has(k)),
      })).filter(section => section.items.length > 0)
    : [];

  function toggleSection(id) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderRow([k, v]) {
    return (
      <div className="summary-row" key={k}>
        <div className="summary-key">
          {k}
          {renderEditLink(k)}
        </div>
        <div className="summary-val">{v}</div>
      </div>
    );
  }

  function renderQuestionEditLink(label, qId) {
    if (!editable || !onEditQuestion || !historyIds.has(qId)) return null;
    return (
      <div className="summary-edit-row" key={`${label}-${qId}`}>
        <span className="summary-key">{label}</span>
        <button type="button" className="summary-edit-link" onClick={() => onEditQuestion(qId)}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className={`summary-card${showPayoffGrid ? " summary-card-grid" : ""}`}>
      {showPayoffGrid ? (
        <div className="summary-grid">
          {payoffRows.map(([k, v]) => (
            <div className="summary-grid-item" key={k}>
              <div className="summary-key">
                {k}
                {renderEditLink(k)}
              </div>
              <div className="summary-val">{v}</div>
            </div>
          ))}
        </div>
      ) : useGroupedSections ? (
        <div className="summary-sections">
          {groupedRows.map(section => (
            <div className="summary-section" key={section.id}>
              <button
                type="button"
                className="summary-section-toggle"
                onClick={() => toggleSection(section.id)}
                aria-expanded={openSections.has(section.id)}
              >
                {section.title}
                <span className="summary-section-count">{section.items.length}</span>
              </button>
              {openSections.has(section.id) && (
                <div className="summary-section-panel">
                  {section.items.map(renderRow)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        rows.map(renderRow)
      )}
      {editable && allAnswerEditRows.length > 0 && onEditQuestion && (
        <div className="summary-all-answers">
          <button
            type="button"
            className="summary-all-answers-toggle"
            onClick={() => setAllAnswersOpen(open => !open)}
            aria-expanded={allAnswersOpen}
          >
            {allAnswersOpen ? "Hide all answers" : "All answers"}
          </button>
          {allAnswersOpen && (
            <div className="summary-all-answers-panel">
              {allAnswerEditRows.map(({ label, qId }) => renderQuestionEditLink(label, qId))}
            </div>
          )}
        </div>
      )}
      {isContinuousDrive(answers) && (
        <div className="summary-kids-note">Drive straight through — no overnight lodging on this trip.</div>
      )}
      {!isContinuousDrive(answers) && answers.trip_type === "Day trip" && (
        <div className="summary-kids-note">Day trip — no overnight stops needed.</div>
      )}
      {isScenicRoute(answers) && (
        <div className="summary-kids-note">Scenic route selected — viewpoints noted at each stop</div>
      )}
      {isRvTrip(answers) && (
        <div className="summary-rv-note">
          RV Safe Route — bridges under 14ft flagged
        </div>
      )}
      {isTruckerTrip(answers) && hosCompliance && (
        <div className="summary-hos-note">
          HOS: {hosCompliance.drivingDays} driving day{hosCompliance.drivingDays > 1 ? "s" : ""}, {hosCompliance.overnightStopsRequired} overnight stop{hosCompliance.overnightStopsRequired !== 1 ? "s" : ""} required
        </div>
      )}
    </div>
  );
}
