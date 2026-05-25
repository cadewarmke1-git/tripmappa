import { useEffect, useState } from "react";
import { geocodeCity, searchNearbyServices } from "../lib/placesSearch.js";
import { NEARBY_SERVICE_CATEGORIES } from "../lib/tripAccommodations.js";

const DEFAULT_CATS = NEARBY_SERVICE_CATEGORIES.filter(c =>
  ["pharmacy", "hospital", "urgent_care", "auto_repair", "atm", "car_wash", "laundry", "tire", "windshield", "shipping"].includes(c.id),
);

export default function NearbyServicesSection({ city, extraCategories = [] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState({});

  const categories = [...DEFAULT_CATS, ...extraCategories.filter(Boolean)];

  useEffect(() => {
    if (!open || !city) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const geo = await geocodeCity(city);
      if (!geo || cancelled) { setLoading(false); return; }
      const data = await searchNearbyServices(geo.lat, geo.lng, categories);
      if (!cancelled) { setServices(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, city, categories.length]);

  return (
    <div className="nearby-services-section">
      <button type="button" className="nearby-services-toggle" onClick={() => setOpen(o => !o)}>
        {open ? "Hide" : "Show"} nearby services
      </button>
      {open && (
        <div className="nearby-services-panel">
          {loading && <div className="nearby-services-loading">Loading services…</div>}
          {!loading && Object.entries(services).map(([key, items]) => {
            const cat = categories.find(c => c?.id === key);
            if (!items?.length) return null;
            return (
              <div key={key} className="nearby-services-group">
                <div className="nearby-services-label">{cat?.label || key}</div>
                {items.map(item => (
                  <div key={item.id} className="nearby-services-row">
                    <span className="nearby-services-name">{item.name}</span>
                    <span className="nearby-services-meta">
                      {item.distanceMiles != null ? `${item.distanceMiles} mi` : ""}
                      {item.phone ? ` · ${item.phone}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
