import { useEffect, useState } from "react";
import { geocodeCity, searchLodging } from "../../lib/placesSearch.js";
import { processLodgingResults } from "../../lib/lodgingPlaces.js";
import { formatStarLabel } from "../../lib/ratings.js";
import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import AmenityBadges from "../lodging/AmenityBadges.jsx";

export default function OvernightStayCard({
  overnight,
  answers,
  routeInfo,
  selectedLodging,
  weather = null,
  onLodgingSelect,
  onToast,
  onSelect,
  highlighted = false,
  cardRef,
}) {
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!overnight?.city) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const geo = overnight.lat != null
        ? { lat: overnight.lat, lng: overnight.lng }
        : await geocodeCity(overnight.city);
      if (!geo || cancelled) { setLoading(false); return; }
      const raw = await searchLodging(geo.lat, geo.lng, answers, routeInfo);
      const hotels = processLodgingResults(raw, answers, routeInfo);
      if (!cancelled) {
        setHotel(hotels[0] || null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [overnight?.city, overnight?.lat, overnight?.lng, answers, routeInfo]);

  const featured = hotel || (selectedLodging.length ? selectedLodging[0] : null);
  const name = featured?.name || overnight?.title || overnight?.city;
  const price = featured?.priceLabel || (featured?.pricePerNight ? `$${featured.pricePerNight}/night` : null);
  const desc = overnight?.description || featured?.description || "Your home base for the night.";
  const photoUrl = featured?.photo || featured?.photoUrl || null;

  function handleBook(e) {
    e?.stopPropagation?.();
    if (featured?.bookUrl) window.open(featured.bookUrl, "_blank", "noopener,noreferrer");
    else onToast?.("Opening booking options…");
    if (featured) onLodgingSelect?.(featured);
  }

  function handleClick() {
    onSelect?.({
      id: overnight?.id || `overnight-${overnight?.city}`,
      lat: overnight?.lat ?? featured?.lat,
      lng: overnight?.lng ?? featured?.lng,
      title: name,
      city: overnight?.city,
    });
  }

  if (loading) {
    return <div className="overnight-card overnight-card-loading">Loading tonight&apos;s stay…</div>;
  }

  return (
    <article
      ref={cardRef}
      className={`overnight-card${highlighted ? " stop-highlighted" : ""}`}
      data-stop-id={overnight?.id || `overnight-${overnight?.city}`}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === "Enter") handleClick(); }}
      role="button"
      tabIndex={0}
    >
      <div className="overnight-card-hero">
        <PlacePhotoOrIcon
          photoUrl={photoUrl}
          name={name}
          category="Stay"
          imgClassName="overnight-card-photo"
          className="overnight-card-photo-fallback"
        />
        <div className="overnight-card-gradient"/>
        {weather?.temperatureDisplay && (
          <div className="overnight-weather-badge" title={weather.condition}>
            <span className="overnight-weather-icon" aria-hidden="true">{weather.icon}</span>
            <span className="overnight-weather-temp">{weather.temperatureDisplay}</span>
          </div>
        )}
      </div>
      <div className="overnight-card-body">
        <h3 className="overnight-card-name">{name}</h3>
        <div className="overnight-card-rating-row">
          {formatStarLabel(featured?.rating ?? overnight?.rating)
            ? <span className="overnight-rating">{formatStarLabel(featured?.rating ?? overnight?.rating)}</span>
            : <span className="overnight-no-reviews">No reviews yet</span>}
          {price && <span className="overnight-price">{price}</span>}
        </div>
        {featured?.amenities && <AmenityBadges amenityIds={featured.amenities} />}
        <p className="overnight-card-desc">{desc}</p>
        <button type="button" className="btn-generate overnight-book-btn" onClick={handleBook}>Book Now</button>
      </div>
    </article>
  );
}
