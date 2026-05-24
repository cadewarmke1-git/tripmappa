import { useState, useEffect, useMemo } from "react";
import { computeBudgetEstimate } from "../lib/budget.js";

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

export default function BudgetCard({ answers, routeInfo, tripLegs }) {
  const est = useMemo(() => computeBudgetEstimate(answers, routeInfo, tripLegs), [answers, routeInfo, tripLegs]);
  const fuelReady = est.fuel != null;
  const lodgingReady = est.lodging != null;
  const foodReady = est.food != null;
  return (
    <div className="budget-card">
      <div className="budget-card-title">Estimated Trip Cost</div>
      <div className="budget-row">
        <span className="budget-row-label">Fuel</span>
        {fuelReady
          ? <AnimatedBudgetValue value={est.fuel ?? 0} animateKey={`fuel-${est.fuel}`} />
          : <span className="budget-shimmer" />}
      </div>
      <div className="budget-row">
        <span className="budget-row-label">Lodging</span>
        {lodgingReady
          ? <AnimatedBudgetValue value={est.lodging ?? 0} animateKey={`lodging-${est.lodging}`} />
          : <span className="budget-shimmer" />}
      </div>
      <div className="budget-row">
        <span className="budget-row-label">Food</span>
        {foodReady
          ? <AnimatedBudgetValue value={est.food ?? 0} animateKey={`food-${est.food}`} />
          : <span className="budget-shimmer" />}
      </div>
      <div className="budget-row budget-row-total">
        <span className="budget-row-label">Total</span>
        {est.total != null
          ? <AnimatedBudgetValue value={est.total} animateKey={`total-${est.total}`} />
          : <span className="budget-shimmer" />}
      </div>
      <div className="budget-disclaimer">Estimates only — real prices after generation.</div>
    </div>
  );
}
