import { useEffect, useState } from "react";
import { geocodeCity, searchRestaurants } from "../lib/placesSearch.js";
import { asArray } from "../lib/tripAccommodations.js";

export default function RestaurantPlacesSection({ city, stopLat, stopLng, answers, onToast }) {
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      let lat = stopLat;
      let lng = stopLng;
      if (lat == null && city) {
        const geo = await geocodeCity(city);
        if (geo) { lat = geo.lat; lng = geo.lng; }
      }
      if (lat == null) { setLoading(false); return; }
      const remoteWork = asArray(answers?.stops_interests).some(i => /remote work|wifi/i.test(i));
      let results = await searchRestaurants(lat, lng, answers);
      if (remoteWork) {
        results = results.filter(r =>
          /cafe|coffee|wifi|starbucks|dunkin|panera|library/i.test(`${r.name} ${r.address}`) || (r.rating ?? 0) >= 4,
        );
      }
      if (!cancelled) {
        setRestaurants(results.slice(0, 6));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [city, stopLat, stopLng, answers]);

  if (loading) return <div className="places-loading">Loading dining from Google Places…</div>;
  if (!restaurants.length) return null;

  return (
    <div className="stop-section">
      <div className="stop-section-head">
        <span className="badge badge-food">FOOD</span> Dining — verified on Google Maps
      </div>
      {restaurants.map(r => (
        <div className="item-row" key={r.id} onClick={() => onToast?.(`Saved ${r.name}`)}>
          <div className="item-info">
            <div className="item-name">
              {r.name}
              {r.wifiAvailable && <span className="mini-badge wifi-badge">WiFi</span>}
              {r.isDetour && <span className="mini-badge detour-badge">+{r.detourMiles} mi detour</span>}
            </div>
            <div className="item-meta">
              {r.rating ? `${r.rating} / 5` : ""}
              {r.distanceMiles != null ? ` · ${r.distanceMiles} mi` : ""}
              {!r.isDetour && r.distanceMiles != null && r.distanceMiles <= 1 ? " · on route" : ""}
            </div>
          </div>
          {r.bookUrl && (
            <a
              href={r.bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="item-time"
              onClick={e => e.stopPropagation()}
            >
              View
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
