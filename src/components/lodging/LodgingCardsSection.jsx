import { useEffect, useState } from "react";
import {
  getHotelsForStop,
  getRvParksForStop,
  getTruckStopsForStop,
  getRestAreasForStop,
  saveLodgingToTrips,
} from "../../lib/lodgingData.js";
import { isTruckerTrip, isRvTrip } from "../../lib/vehicles.js";
import HotelCard from "./HotelCard.jsx";
import RvParkCard from "./RvParkCard.jsx";
import TruckStopCard from "./TruckStopCard.jsx";
import RestAreaCard from "./RestAreaCard.jsx";
import LodgingCardSkeleton from "./LodgingCardSkeleton.jsx";

const LOAD_MS = 700;

export default function LodgingCardsSection({
  city,
  answers,
  origin,
  dest,
  onToast,
  onLodgingSelect,
  selectedLodging = [],
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [restAreas, setRestAreas] = useState([]);
  const [lodgingType, setLodgingType] = useState("hotel");

  const isTrucker = isTruckerTrip(answers);
  const isRv = isRvTrip(answers);
  const showSleeperOnly = isTrucker && answers?.lodging === "Sleeper cab — no hotel needed";

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      if (isRv) {
        setLodgingType("rv");
        setItems(getRvParksForStop(city));
        setRestAreas([]);
      } else if (isTrucker) {
        setLodgingType("truck");
        setItems(getTruckStopsForStop(city, answers));
        setRestAreas(getRestAreasForStop(city));
      } else {
        setLodgingType("hotel");
        setItems(getHotelsForStop(city, answers));
        setRestAreas([]);
      }
      setLoading(false);
    }, LOAD_MS);
    return () => clearTimeout(timer);
  }, [city, answers, isRv, isTrucker]);

  function handleSave(lodging) {
    saveLodgingToTrips(lodging, city, origin, dest);
    onLodgingSelect?.(lodging);
    onToast?.(selectedLodging.some(l => l.id === lodging.id)
      ? `Removed ${lodging.name} from budget`
      : `Added ${lodging.name} to budget`);
  }

  if (showSleeperOnly) {
    return (
      <div className="lodging-section">
        <div className="lodging-section-label">Overnight parking</div>
        <div className="sleeper-cab-card">
          <div className="item-name">Sleeper cab — no hotel needed</div>
          <div className="item-meta">Truck stop parking reserved · Showers and laundry on site</div>
        </div>
      </div>
    );
  }

  const sectionLabel = lodgingType === "rv"
    ? "RV parks & campgrounds"
    : lodgingType === "truck"
      ? "Truck stops"
      : "Hotels & lodging";

  const skeletonCount = lodgingType === "truck" ? 4 : 3;

  return (
    <div className="lodging-section">
      <div className="lodging-section-label">{sectionLabel}</div>

      {loading ? (
        <div className="lodging-cards-scroll">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <LodgingCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="lodging-cards-scroll">
            {lodgingType === "hotel" && items.map(hotel => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                onSave={handleSave}
                onToast={onToast}
              />
            ))}
            {lodgingType === "rv" && items.map(park => (
              <RvParkCard
                key={park.id}
                park={park}
                onSave={handleSave}
                onToast={onToast}
              />
            ))}
            {lodgingType === "truck" && items.map(stop => (
              <TruckStopCard
                key={stop.id}
                stop={stop}
                onSave={handleSave}
                onToast={onToast}
              />
            ))}
          </div>

          {lodgingType === "truck" && restAreas.length > 0 && (
            <>
              <div className="lodging-section-sublabel">Rest areas — backup option</div>
              <div className="lodging-cards-scroll lodging-cards-rest">
                {restAreas.map(area => (
                  <RestAreaCard
                    key={area.id}
                    restArea={area}
                    onSave={handleSave}
                    onToast={onToast}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p className="lodging-disclaimer">Prices are estimates — final rates shown at booking.</p>
    </div>
  );
}
