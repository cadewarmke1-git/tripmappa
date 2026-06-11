import { useMemo } from "react";
import { resolveHeroVariant, shouldShowRouteHighlightChips, classifyTripCategory } from "../../lib/resolveHeroVariant.js";
import {
  formatHosSummaryLine,
  countFuelAndWeighStops,
  findTruckParkingWarning,
  collectRouteHighlights,
  formatPriceBandLabel,
  resolveOvernightHotel,
  buildMultiDayChips,
  dayTripHeroStats,
  formatArriveByTime,
} from "../../lib/heroVariantContent.js";
import PlaceRatingLine from "./PlaceRatingLine.jsx";

function RouteHighlightChips({ highlights }) {
  if (!highlights.length) return null;
  return (
    <div className="results-route-highlights" aria-label="Route highlights">
      {highlights.map((label) => (
        <span key={label} className="results-route-highlight-chip">{label}</span>
      ))}
    </div>
  );
}

export default function ResultsHero({
  variant: variantProp,
  collapsed = false,
  origin,
  dest,
  answers,
  stops = [],
  roadStops = [],
  routeInfo,
  days = [],
  recommendations = [],
  selectedLodging = [],
  waypoints = [],
  tripTips = [],
  hosCompliance = null,
  timingMode,
  arriveByDate,
  departureTime,
  onDayChipSelect,
  reveal = false,
}) {
  const tripCategory = classifyTripCategory(answers);
  const variant = variantProp || resolveHeroVariant(answers, tripCategory, stops);
  const scenicChips = shouldShowRouteHighlightChips(answers, variant);
  const highlights = useMemo(
    () => collectRouteHighlights({ days, roadStops, recommendations }),
    [days, roadStops, recommendations],
  );

  const truckEta = routeInfo?.duration || "—";
  const hosLine = formatHosSummaryLine(hosCompliance, routeInfo);
  const { fuel, weigh, total: fuelWeighTotal } = countFuelAndWeighStops(roadStops);
  const parkingWarning = findTruckParkingWarning({ tips: tripTips, timingMode, arriveByDate });

  const { city: overnightCity, hotel: overnightHotel } = resolveOvernightHotel(stops, selectedLodging);
  const overnightArrive = formatArriveByTime(departureTime, days[0]?.drivingSummary);
  const dayStats = dayTripHeroStats({ routeInfo, stops, roadStops, days, recommendations, waypoints });
  const multiDayChips = buildMultiDayChips(days, dest);

  const condensedLine = useMemo(() => {
    if (variant === "truck") return `${truckEta} · ${fuelWeighTotal} fuel & weigh stops`;
    if (variant === "overnight") return `${overnightCity} · ${formatArriveByTime(departureTime, days[0]?.drivingSummary)}`;
    if (variant === "multiDay") return `${days.length} days · ${routeInfo?.distance || ""}`.trim();
    return `${dayStats.stopCount} stops · ${dayStats.duration}`;
  }, [variant, truckEta, fuelWeighTotal, overnightCity, days, routeInfo, dayStats, departureTime]);

  return (
    <div className={`results-hero results-hero-${variant}${collapsed ? " results-hero-collapsed" : ""}${reveal ? " results-hero-reveal" : ""}`}>
      {collapsed ? (
        <p className="results-hero-condensed" data-testid="results-hero-condensed">{condensedLine}</p>
      ) : (
        <>
          {variant === "truck" && (
            <div className="results-hero-content" data-testid="results-hero-truck">
              <p className="results-hero-lead">
                <span className="results-hero-lead-label">Arrival ETA</span>
                <span className="results-hero-lead-value">{truckEta}</span>
              </p>
              <p className="results-hero-meta-line">{hosLine}</p>
              <p className="results-hero-meta-line">
                {fuel} fuel · {weigh} weigh · {fuelWeighTotal} total stops
              </p>
              {parkingWarning && (
                <p className="results-hero-parking-warning">{parkingWarning}</p>
              )}
            </div>
          )}

          {variant === "overnight" && (
            <div className="results-hero-content" data-testid="results-hero-overnight">
              <p className="results-hero-lead">
                <span className="results-hero-lead-label">Your journey</span>
                <span className="results-hero-lead-value">
                  {dayStats.stopCount} stops · {dayStats.duration}
                </span>
              </p>
              <h1 className="results-hero-display-title">{overnightCity}</h1>
              <p className="results-hero-inline-lodging">
                {overnightHotel?.name || "Tonight's stay"}
                {formatPriceBandLabel(overnightHotel) && (
                  <span className="results-hero-price-band"> · {formatPriceBandLabel(overnightHotel)}</span>
                )}
                <PlaceRatingLine rating={overnightHotel?.rating} className="results-hero-rating" />
              </p>
              <p className="results-hero-meta-line">
                Arrive by <strong>{overnightArrive}</strong>
              </p>
            </div>
          )}

          {variant === "multiDay" && (
            <div className="results-hero-content" data-testid="results-hero-multiday">
              <p className="results-hero-lead">
                <span className="results-hero-lead-label">Your journey</span>
                <span className="results-hero-lead-value">
                  {dayStats.stopCount} stops · {routeInfo?.duration || dayStats.duration}
                </span>
              </p>
              <div className="results-hero-day-chips" role="tablist" aria-label="Trip days">
                {multiDayChips.map((chip) => (
                  <button
                    key={chip.dayIndex}
                    type="button"
                    role="tab"
                    className="results-hero-day-chip"
                    onClick={() => onDayChipSelect?.(chip.dayIndex)}
                  >
                    <span className="results-hero-day-chip-label">{chip.label}</span>
                    <span className="results-hero-day-chip-sub">{chip.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(variant === "day" || variant === "scenicDay") && (
            <div className="results-hero-content" data-testid={`results-hero-${variant}`}>
              <p className="results-hero-lead">
                <span className="results-hero-lead-label">Your journey</span>
                <span className="results-hero-lead-value">
                  {dayStats.stopCount} stops · {dayStats.duration}
                </span>
              </p>
              {dayStats.firstHighlight && (
                <p className="results-hero-meta-line">
                  First highlight: <strong>{dayStats.firstHighlight}</strong>
                </p>
              )}
            </div>
          )}
        </>
      )}

      {scenicChips && !collapsed && <RouteHighlightChips highlights={highlights} />}
    </div>
  );
}
