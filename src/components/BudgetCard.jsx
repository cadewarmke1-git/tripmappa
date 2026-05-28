import { useState, useEffect, useMemo } from "react";
import { computeBudgetEstimate } from "../lib/budget.js";
import { parseTravelerCount } from "../lib/vehicles.js";
import { getTripBudgetCap } from "../lib/tripAccommodations.js";

function AnimatedBudgetValue({ value, animateKey }) {
  const [display, setDisplay] = useState(0);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (value == null) return;
    const target = Math.round(value);
    const start = display;
    const diff = target - start;
    if (diff === 0) return;
    const steps = 12;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      setDisplay(Math.round(start + (diff * step) / steps));
      if (step >= steps) clearInterval(id);
    }, 25);
    setPop(true);
    const t = setTimeout(() => setPop(false), 350);
    return () => { clearInterval(id); clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateKey, value]);
  if (value == null) return <span className="budget-shimmer" />;
  return <span className={`budget-row-val${pop ? " animate" : ""}`}>${display.toLocaleString()}</span>;
}

export default function BudgetCard({
  answers, routeInfo, tripLegs, roadStops = [], selectedLodging = [], restaurantsByCity = {}, compact = false,
}) {
  const est = useMemo(() => {
    try {
      return computeBudgetEstimate(answers, routeInfo, tripLegs, { roadStops, selectedLodging, restaurantsByCity });
    } catch (err) {
      console.error("BudgetCard estimate failed:", err);
      return { fuel: null, lodging: null, food: null, total: null, addedStops: [] };
    }
  }, [answers, routeInfo, tripLegs, roadStops, selectedLodging, restaurantsByCity]);

  const fuelReady = est.fuel != null;
  const lodgingReady = est.lodging != null;
  const foodReady = est.food != null;
  const hasAddedItems = est.addedStops?.length > 0;
  const budgetCap = getTripBudgetCap(answers);
  const partySize = parseTravelerCount(answers?.travelers) ?? 1;
  const perPerson = est.total != null && partySize > 0 ? Math.round(est.total / partySize) : null;
  const showBudgetWarning = budgetCap != null && est.total != null && budgetCap - est.total <= 50;

  if (compact) {
    return (
      <div className="budget-card budget-card-compact">
        <span className="budget-card-compact-label">Estimated Trip Cost</span>
        {est.total != null
          ? <AnimatedBudgetValue value={est.total} animateKey={`total-compact-${est.total}`} />
          : <span className="budget-shimmer" />}
      </div>
    );
  }

  return (
    <div className={`budget-card${showBudgetWarning ? " budget-card-warning" : ""}`}>
      <div className="budget-card-header">
        <div className="budget-card-title">Estimated Trip Cost</div>
        {showBudgetWarning && <span className="budget-warning-badge">Budget warning</span>}
      </div>
      {budgetCap != null && est.total != null && (
        <div className="budget-tracker">
          <div className="budget-tracker-bar">
            <div
              className="budget-tracker-fill"
              style={{ width: `${Math.min(100, (est.total / budgetCap) * 100)}%` }}
            />
          </div>
          <div className="budget-tracker-label">
            ${Math.round(est.total).toLocaleString()} of ${budgetCap.toLocaleString()} budget used
          </div>
        </div>
      )}
      <div className="budget-row">
        <span className="budget-row-label">Fuel</span>
        {fuelReady
          ? <AnimatedBudgetValue value={est.fuel ?? 0} animateKey={`fuel-${est.fuel}-${est.addedFuelCost}`} />
          : <span className="budget-shimmer" />}
      </div>
      <div className="budget-row">
        <span className="budget-row-label">Lodging</span>
        {lodgingReady
          ? <AnimatedBudgetValue value={est.lodging ?? 0} animateKey={`lodging-${est.lodging}-${selectedLodging.length}`} />
          : <span className="budget-shimmer" />}
      </div>
      <div className="budget-row">
        <span className="budget-row-label">Food</span>
        {foodReady
          ? <AnimatedBudgetValue value={est.food ?? 0} animateKey={`food-${est.food}-${est.addedFoodCost}-${Object.keys(restaurantsByCity).length}`} />
          : <span className="budget-shimmer" />}
      </div>
      <div className="budget-row budget-row-total">
        <span className="budget-row-label">Total</span>
        {est.total != null
          ? <AnimatedBudgetValue value={est.total} animateKey={`total-${est.total}-${roadStops.length}-${selectedLodging.length}`} />
          : <span className="budget-shimmer" />}
      </div>
      {perPerson != null && partySize > 1 && (
        <div className="budget-per-person">~${perPerson.toLocaleString()} per person ({partySize} travelers)</div>
      )}

      {hasAddedItems && (
        <div className="budget-breakdown">
          <div className="budget-breakdown-label">Added to trip</div>
          {est.addedStops.map(item => (
            <div className="budget-breakdown-row" key={item.id}>
              <span className="budget-breakdown-name">{item.label}</span>
              <AnimatedBudgetValue value={item.cost} animateKey={`item-${item.id}-${item.cost}`} />
            </div>
          ))}
        </div>
      )}

      <div className="budget-disclaimer">Estimates only — updates as you add stops.</div>
    </div>
  );
}
