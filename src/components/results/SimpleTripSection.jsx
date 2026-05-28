import RoadStopCard from "./RoadStopCard.jsx";
import ActivityDiningCard from "./ActivityDiningCard.jsx";
import OvernightStayCard from "./OvernightStayCard.jsx";
import LodgingCardsSection from "../lodging/LodgingCardsSection.jsx";
import RestaurantCardsSection from "../restaurants/RestaurantCardsSection.jsx";

function findCityData(map, city) {
  if (!city || !map) return null;
  if (map[city]) return map[city];
  const key = Object.keys(map).find(k =>
    k.split(",")[0].trim().toLowerCase() === city.split(",")[0].trim().toLowerCase(),
  );
  return key ? map[key] : null;
}

export default function SimpleTripSection({
  days,
  roadStops,
  stops = [],
  recommendations = [],
  answers,
  origin,
  dest,
  routeInfo,
  weatherByCity = {},
  restaurantsByCity = {},
  selectedLodging = [],
  onLodgingSelect,
  onToast,
  onAddRoadStop,
  highlightedStopId,
  stopRefs,
  onStopSelect,
}) {
  const day = days[0];
  const roadItems = day?.roadStops?.length ? day.roadStops : roadStops.map((rs, i) => ({
    id: rs.id || `road-${i}`,
    title: rs.name,
    category: rs.category,
    rating: rs.rating,
    distanceFromRoute: rs.distanceMiles ?? rs.distance,
    photoUrl: rs.photoUrl,
    lat: rs.lat,
    lng: rs.lng,
    stopData: rs,
    nearbyRestaurants: rs.nearbyRestaurants,
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

  const mealStops = day?.overnight
    ? [day.overnight]
    : stops.filter(s => s.city).length
      ? stops.filter(s => s.city)
      : dest
        ? [{ city: dest, lat: null, lng: null, id: "dest-meal" }]
        : [];

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

      {roadItems.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Stops Along the Way</h3>
          <div className="results-road-stops-scroll">
            {roadItems.map(stop => (
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

      {day?.overnight && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Tonight&apos;s Stay</h3>
          <OvernightStayCard
            overnight={day.overnight}
            answers={answers}
            routeInfo={routeInfo}
            selectedLodging={selectedLodging}
            weather={findCityData(weatherByCity, day.overnight.city)}
            onLodgingSelect={onLodgingSelect}
            onToast={onToast}
            onSelect={onStopSelect}
            highlighted={highlightedStopId === (day.overnight.id || `overnight-${day.overnight.city}`)}
            cardRef={setStopRef(day.overnight.id || `overnight-${day.overnight.city}`)}
          />
          <LodgingCardsSection
            city={day.overnight.city}
            answers={answers}
            origin={origin}
            dest={dest}
            routeInfo={routeInfo}
            selectedLodging={selectedLodging}
            onLodgingSelect={onLodgingSelect}
            onToast={onToast}
          />
          <RestaurantCardsSection
            city={day.overnight.city}
            lat={day.overnight.lat}
            lng={day.overnight.lng}
            answers={answers}
            preloaded={findCityData(restaurantsByCity, day.overnight.city)}
            onToast={onToast}
          />
        </div>
      )}

      {!day?.overnight && mealStops.map((stop, idx) => {
        const city = stop.city || dest;
        const weather = findCityData(weatherByCity, city);
        const preloaded = findCityData(restaurantsByCity, city);
        const lat = stop.lat ?? weather?.lat;
        const lng = stop.lng ?? weather?.lng;
        if (!city) return null;
        return (
          <div className="results-subsection" key={stop.id || `meal-${idx}`}>
            <h3 className="results-subsection-label">
              {idx === 0 && dest ? "Meals near your destination" : `Meals in ${city.split(",")[0]}`}
            </h3>
            {weather?.temperatureDisplay && (
              <div className="simple-trip-weather-badge" title={weather.condition}>
                <span className="overnight-weather-icon" aria-hidden="true">{weather.icon}</span>
                <span className="overnight-weather-temp">{weather.temperatureDisplay}</span>
                <span className="simple-trip-weather-city">{city.split(",")[0]}</span>
              </div>
            )}
            <RestaurantCardsSection
              city={city}
              lat={lat}
              lng={lng}
              answers={answers}
              preloaded={preloaded}
              onToast={onToast}
            />
          </div>
        );
      })}

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
