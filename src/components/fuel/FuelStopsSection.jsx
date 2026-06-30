import { useMemo } from "react";
import { parseMilesFromDistance } from "../../lib/parsing.js";
import { buildFuelIntervalPoints, getFuelStopMode, computeSegmentMiles, fuelStopToRoadStop } from "../../lib/fuel.js";
import FuelStopsRow from "./FuelStopsRow.jsx";

export default function FuelStopsSection({
  answers,
  routeInfo,
  stops,
  onAddFuelStop,
  onToast,
  readOnly = false,
}) {
  const mode = getFuelStopMode(answers);
  const totalMiles = parseMilesFromDistance(routeInfo?.distance);

  const intervalPoints = useMemo(() => {
    const routePoints = routeInfo?.routePoints;
    if (!routePoints?.length || mode === "none") return [];
    return buildFuelIntervalPoints(routePoints, stops.length, totalMiles, answers);
  }, [routeInfo?.routePoints, stops.length, totalMiles, answers, mode]);

  if (mode === "none" || !intervalPoints.length) return null;

  function handleAdd(stop, type) {
    onAddFuelStop?.(fuelStopToRoadStop(stop, type));
  }

  return (
    <div className="fuel-stops-section">
      <div className="stops-section-label">
        {mode === "ev" || mode === "hybrid" ? "Fuel & charging stops" : mode === "diesel" ? "Diesel stops" : mode === "rv" ? "Fuel & propane stops" : "Fuel stops"}
      </div>
      {intervalPoints.map((point, i) => {
        const miles = computeSegmentMiles(totalMiles, point.segmentIndex ?? i, intervalPoints.length);
        const label = point.required
          ? `Required charge · ~${miles ?? "—"} mi from start`
          : miles != null
            ? `Along route · ~${miles} mi from start`
            : "Along route";
        return (
          <FuelStopsRow
            key={`fuel-${i}-${point.lat}-${point.lng}`}
            point={point}
            answers={answers}
            segmentLabel={label}
            onAddStop={handleAdd}
            onToast={onToast}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}
