import { useMemo } from "react";
import { computeBudgetEstimate } from "../lib/budget.js";

export default function PlanFuelEstimateFooter({
  answers,
  routeInfo,
  tripLegs = [],
}) {
  const fuel = useMemo(() => {
    try {
      const est = computeBudgetEstimate(answers, routeInfo, tripLegs);
      return est.fuel;
    } catch {
      return null;
    }
  }, [answers, routeInfo, tripLegs]);

  return (
    <footer className="plan-ready-fuel-footer" aria-label="Estimated fuel cost">
      <div className="plan-ready-fuel-footer-left">
        <span className="plan-ready-fuel-label">Estimated fuel cost</span>
        <span className="plan-ready-fuel-note">Rough estimate · regional avg</span>
      </div>
      <span className="plan-ready-fuel-value">
        {fuel != null ? `$${Math.round(fuel).toLocaleString()}` : "—"}
      </span>
    </footer>
  );
}
