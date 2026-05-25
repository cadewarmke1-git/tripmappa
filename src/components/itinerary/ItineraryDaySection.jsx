import { useRef, useEffect, useCallback } from "react";
import ItineraryStopCard from "./ItineraryStopCard.jsx";
import LodgingCardsSection from "../lodging/LodgingCardsSection.jsx";
import NearbyServicesSection from "../NearbyServicesSection.jsx";

export default function ItineraryDaySection({
  day,
  answers,
  origin,
  dest,
  routeInfo,
  selectedLodging,
  onLodgingSelect,
  onToast,
  onFocusMap,
  onAddRoadStop,
  isTruckerResults,
  isRvResults,
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
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add("itinerary-day-visible"); },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [day.dayNumber]);

  return (
    <section className="itinerary-day" ref={mergedRef}>
      <div className="itinerary-day-header">
        <h2 className="itinerary-day-label">{day.label}</h2>
        {day.date && <span className="itinerary-day-date">{day.date}</span>}
      </div>
      <div className="itinerary-timeline">
        {day.items.map((item, i) => (
          <div key={item.id} className="itinerary-timeline-item">
            <div className="itinerary-timeline-rail"><span className="itinerary-timeline-dot"/></div>
            <div className="itinerary-timeline-content">
              <ItineraryStopCard
                item={item}
                index={i}
                onFocusMap={onFocusMap}
                onAction={() => {
                  if (item.action === "add") onAddRoadStop?.(item.stopData || item);
                }}
              />
              {item.type === "overnight" && !isTruckerResults && !isRvResults && (
                <div className="itinerary-lodging-embed">
                  <LodgingCardsSection
                    city={item.city}
                    answers={answers}
                    origin={origin}
                    dest={dest}
                    routeInfo={routeInfo}
                    selectedLodging={selectedLodging}
                    onLodgingSelect={onLodgingSelect}
                    onToast={onToast}
                  />
                  <NearbyServicesSection city={item.city} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
