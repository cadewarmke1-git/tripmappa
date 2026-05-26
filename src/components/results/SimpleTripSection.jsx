import RoadStopCard from "./RoadStopCard.jsx";
import ActivityDiningCard from "./ActivityDiningCard.jsx";

export default function SimpleTripSection({
  days,
  roadStops,
  recommendations = [],
  onAddRoadStop,
  highlightedStopId,
  stopRefs,
  onStopSelect,
}) {
  const day = days[0];
  const stops = day?.roadStops?.length ? day.roadStops : roadStops.map((rs, i) => ({
    id: rs.id || `road-${i}`,
    title: rs.name,
    category: rs.category,
    rating: rs.rating,
    distanceFromRoute: rs.distanceMiles ?? rs.distance,
    photoUrl: rs.photoUrl,
    lat: rs.lat,
    lng: rs.lng,
    stopData: rs,
  }));

  const recs = recommendations.length
    ? recommendations.map((r, i) => ({
      id: r.id || `rec-${i}`,
      name: r.name,
      category: r.category || "Recommendation",
      rating: r.rating,
      photoUrl: r.photoUrl,
      distanceMiles: r.distanceMiles,
    }))
    : (day?.activities || []);

  function setStopRef(id) {
    return (el) => {
      if (el && stopRefs) stopRefs.current[id] = el;
    };
  }

  return (
    <section className="results-day-section results-day-visible simple-trip-section">
      <div className="results-day-header">
        <h2 className="results-day-label">Your Trip</h2>
        {day?.date && <span className="results-day-date">{day.date}</span>}
      </div>
      <div className="results-day-divider"/>
      {day?.drivingSummary && (
        <p className="results-driving-summary">
          {day.drivingSummary.miles} · {day.drivingSummary.duration} driving
        </p>
      )}

      {stops.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Stops Along the Way</h3>
          <div className="results-road-stops-scroll">
            {stops.map(stop => (
              <RoadStopCard
                key={stop.id}
                stop={stop}
                onAdd={onAddRoadStop}
                onSelect={item => onStopSelect?.({ ...item, lat: item.lat ?? item.stopData?.lat, lng: item.lng ?? item.stopData?.lng })}
                highlighted={highlightedStopId === stop.id}
                cardRef={setStopRef(stop.id)}
              />
            ))}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Things to Do and Eat</h3>
          <div className="results-activities-grid">
            {recs.map(item => (
              <ActivityDiningCard key={item.id} item={item} onAdd={onAddRoadStop}/>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
