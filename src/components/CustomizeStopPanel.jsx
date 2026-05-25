import { useRef, useState } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { geocodeCity } from "../lib/placesSearch.js";

export default function CustomizeStopPanel({ city, isLoaded, onAddCustomStop, onBudgetImpact }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const inputRef = useRef(null);
  const acRef = useRef(null);

  async function handleAdd() {
    if (!place) return;
    const stop = {
      id: `custom-${Date.now()}`,
      name: place.name,
      address: place.formatted_address,
      lat: place.geometry?.location?.lat(),
      lng: place.geometry?.location?.lng(),
      category: "custom",
      city,
    };
    onAddCustomStop?.(stop);
    onBudgetImpact?.({ timeMinutes: 25, fuelCost: 8 });
    setPlace(null);
    if (inputRef.current) inputRef.current.value = "";
    setOpen(false);
  }

  return (
    <div className="customize-stop-wrap">
      <button type="button" className="customize-stop-toggle" onClick={() => setOpen(o => !o)}>
        Customize my stop
      </button>
      {open && isLoaded && (
        <div className="customize-stop-panel">
          <div className="customize-stop-hint">Search within 10 miles of {city}</div>
          <Autocomplete
            onLoad={ac => { acRef.current = ac; }}
            onPlaceChanged={() => {
              const p = acRef.current?.getPlace?.();
              if (p?.geometry) setPlace(p);
            }}
            options={{ types: ["establishment", "geocode"] }}
          >
            <input ref={inputRef} className="customize-stop-input" placeholder="Search for a place…" />
          </Autocomplete>
          <button type="button" className="btn-generate customize-stop-add" disabled={!place} onClick={handleAdd}>
            Add to trip
          </button>
        </div>
      )}
    </div>
  );
}
