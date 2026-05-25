import { useEffect, useState } from "react";
import { fetchFuelStations, fetchEvCharging } from "../../lib/apiClient.js";
import {
  getFuelStopMode,
  takeClosest,
  buildFallbackGasStations,
  buildFallbackEvStations,
  buildFallbackPropane,
} from "../../lib/fuel.js";
import FuelStopCard from "./FuelStopCard.jsx";

function FuelSkeleton() {
  return (
    <div className="fuel-stop-card fuel-stop-skeleton" aria-hidden="true">
      <div className="skeleton-shimmer skeleton-fuel-logo" />
      <div className="skeleton-line skeleton-shimmer skeleton-fuel-title" />
      <div className="skeleton-line skeleton-shimmer skeleton-fuel-price" />
      <div className="skeleton-btn skeleton-shimmer" />
    </div>
  );
}

export default function FuelStopsRow({
  point,
  answers,
  segmentLabel,
  onAddStop,
  onToast,
}) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const mode = getFuelStopMode(answers);

  useEffect(() => {
    if (mode === "none" || !point?.lat) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      const lat = point.lat;
      const lng = point.lng;
      const collected = [];

      try {
        if (mode === "gas" || mode === "diesel" || mode === "hybrid") {
          const apiMode = mode === "diesel" ? "diesel" : "gas";
          const gasRes = await fetchFuelStations(lat, lng, apiMode);
          let gasStations = gasRes.stations || [];
          if (gasRes.fallback || !gasStations.length) {
            gasStations = buildFallbackGasStations(lat, lng, apiMode);
            if (!cancelled) setUsedFallback(true);
          }
          collected.push(...gasStations.map(s => ({
            ...s,
            cardType: apiMode === "diesel" ? "diesel" : "gas",
            estimated: s.estimated || gasRes.fallback,
            livePrices: !gasRes.fallback && !s.estimated,
          })));
        }

        if (mode === "rv") {
          const [gasRes, dieselRes] = await Promise.all([
            fetchFuelStations(lat, lng, "gas"),
            fetchFuelStations(lat, lng, "diesel"),
          ]);
          let gasStations = gasRes.stations?.length ? gasRes.stations : buildFallbackGasStations(lat, lng, "gas");
          let dieselStations = dieselRes.stations?.length ? dieselRes.stations : buildFallbackGasStations(lat, lng, "diesel");
          if (gasRes.fallback || dieselRes.fallback) {
            if (!cancelled) setUsedFallback(true);
          }
          collected.push(...gasStations.map(s => ({
            ...s,
            cardType: "gas",
            estimated: s.estimated || gasRes.fallback,
            livePrices: !gasRes.fallback && !s.estimated,
          })));
          collected.push(...dieselStations.map(s => ({
            ...s,
            cardType: "diesel",
            estimated: s.estimated || dieselRes.fallback,
            livePrices: !dieselRes.fallback && !s.estimated,
          })));
        }

        if (mode === "ev" || mode === "hybrid") {
          const evRes = await fetchEvCharging(lat, lng, "ELEC");
          let evStations = evRes.stations || [];
          if (evRes.fallback || !evStations.length) {
            evStations = buildFallbackEvStations(lat, lng);
            if (!cancelled) setUsedFallback(true);
          }
          collected.push(...evStations.map(s => ({ ...s, cardType: "ev" })));
        }

        if (mode === "rv") {
          const propaneRes = await fetchEvCharging(lat, lng, "LPG");
          let propane = propaneRes.stations || [];
          if (propaneRes.fallback || !propane.length) {
            propane = buildFallbackPropane(lat, lng);
            if (propaneRes.fallback && !cancelled) setUsedFallback(true);
          }
          collected.push(...propane.map(s => ({ ...s, cardType: "propane" })));
        }

        if (!cancelled) {
          setCards(takeClosest(collected, 3));
        }
      } catch {
        if (!cancelled) {
          setUsedFallback(true);
          const fallback = [];
          if (mode === "diesel" || mode === "rv") {
            fallback.push(...buildFallbackGasStations(lat, lng, "diesel").map(s => ({ ...s, cardType: "diesel", estimated: true })));
          }
          if (mode === "gas" || mode === "hybrid" || mode === "rv") {
            fallback.push(...buildFallbackGasStations(lat, lng, "gas").map(s => ({ ...s, cardType: "gas", estimated: true })));
          }
          if (mode === "ev" || mode === "hybrid") {
            fallback.push(...buildFallbackEvStations(lat, lng).map(s => ({ ...s, cardType: "ev", estimated: true })));
          }
          if (mode === "rv") {
            fallback.push(...buildFallbackPropane(lat, lng).map(s => ({ ...s, cardType: "propane", estimated: true })));
          }
          setCards(takeClosest(fallback, 3));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [point?.lat, point?.lng, mode]);

  if (mode === "none") return null;

  function handleAdd(stop, type) {
    onAddStop?.(stop, type);
    onToast?.(`Added ${stop.name} to your trip`);
  }

  return (
    <div className="fuel-stops-row-wrap">
      {segmentLabel && <div className="fuel-segment-label">{segmentLabel}</div>}
      {loading ? (
        <div className="fuel-stops-scroll">
          {[0, 1, 2].map(i => <FuelSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="fuel-stops-scroll">
            {cards.map(stop => (
              <FuelStopCard
                key={stop.id}
                stop={stop}
                type={stop.cardType}
                required={point.required && stop.cardType === "ev"}
                onAdd={handleAdd}
              />
            ))}
          </div>
          {usedFallback && (
            <p className="fuel-fallback-note">Estimated — live prices unavailable</p>
          )}
        </>
      )}
    </div>
  );
}
