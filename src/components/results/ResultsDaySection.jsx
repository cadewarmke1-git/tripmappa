import { useRef, useEffect, useCallback } from "react";
import RoadStopCard from "./RoadStopCard.jsx";
import OvernightStayCard from "./OvernightStayCard.jsx";
import ActivityDiningCard from "./ActivityDiningCard.jsx";

export default function ResultsDaySection({
  day,
  answers,
  routeInfo,
  selectedLodging,
  onLodgingSelect,
  onToast,
  onAddRoadStop,
  sectionRef,
}) {
  const sectionEl = useRef(null);

  const mergedRef = useCallback((el) => {
    sectionEl.current = el;
    if (typeof sectionRef === "function") sectionRef(el);
  }, [sectionRef]);

  useEffect(() => {
    const el = sectionEl.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add("results-day-visible"); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [day.dayNumber]);

  return (
    <section className="results-day-section" ref={mergedRef}>
      <div className="results-day-header">
        <h2 className="results-day-label">{day.label}</h2>
        {day.date && <span className="results-day-date">{day.date}</span>}
      </div>
      <div className="results-day-divider"/>

      <p className="results-driving-summary">
        {day.drivingSummary?.miles} · {day.drivingSummary?.duration} driving
      </p>

      {day.roadStops?.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Stops Along the Way</h3>
          <div className="results-road-stops-scroll">
            {day.roadStops.map(stop => (
              <RoadStopCard key={stop.id} stop={stop} onAdd={onAddRoadStop}/>
            ))}
          </div>
        </div>
      )}

      {day.overnight && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Tonight&apos;s Stay</h3>
          <OvernightStayCard
            overnight={day.overnight}
            answers={answers}
            routeInfo={routeInfo}
            selectedLodging={selectedLodging}
            onLodgingSelect={onLodgingSelect}
            onToast={onToast}
          />
        </div>
      )}

      {day.activities?.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Things to Do and Eat</h3>
          <div className="results-activities-grid">
            {day.activities.map(item => (
              <ActivityDiningCard key={item.id} item={item} onAdd={onAddRoadStop}/>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
