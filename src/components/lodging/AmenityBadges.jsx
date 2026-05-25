import { AMENITY_DEFS } from "../../lib/lodgingData.js";

export default function AmenityBadges({ amenityIds }) {
  if (!amenityIds?.length) return null;
  return (
    <div className="lodging-amenities">
      {amenityIds.map(id => {
        const def = AMENITY_DEFS[id];
        if (!def) return null;
        return (
          <span key={id} className="lodging-amenity-badge">
            <span className="lodging-amenity-icon" aria-hidden="true">{def.icon}</span>
            {def.label}
          </span>
        );
      })}
    </div>
  );
}
