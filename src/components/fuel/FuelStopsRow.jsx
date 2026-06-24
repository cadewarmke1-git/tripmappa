import { useEffect, useState } from "react";
import { enrichFuelStations, discoverEvCharging, enrichEvCharging } from "../../lib/apiClient.js";
import { isTeslaSuperchargerOnly } from "../../lib/tripAccommodations.js";
import {
  searchGasStations,
  searchDieselStations,
  searchEvChargingStations,
  searchPropaneStations,
} from "../../lib/placesStations.js";
import {
  getFuelStopMode,
  takeClosest,
  selectOnRouteFuelStations,
  markBestPriceFuelStations,
  buildFallbackGasStations,
  buildFallbackEvStations,
  buildFallbackPropane,
  filterStationsByPreferredBrand,
} from "../../lib/fuel.js";
import { applyStopFilters } from "../../lib/placesFilters.js";
import { isPlausibleEvChargingStation } from "../../lib/roadStopCategory.js";
import FuelStopCard from "./FuelStopCard.jsx";

import RouteDrawingLoader from "../RouteDrawingLoader.jsx";

function FuelSkeleton() {
  return (
    <div className="fuel-stop-card fuel-stop-loader" aria-hidden="true">
      <RouteDrawingLoader variant="compact" />
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
          const googleStations = apiMode === "diesel"
            ? await searchDieselStations(lat, lng, 10)
            : await searchGasStations(lat, lng, 10);
          let gasStations = googleStations;
          if (googleStations.length) {
            const enriched = await enrichFuelStations(googleStations, apiMode);
            gasStations = enriched.stations || googleStations;
            if (enriched.fallback) {
              if (!cancelled) setUsedFallback(true);
            }
          } else {
            gasStations = buildFallbackGasStations(lat, lng, apiMode);
            if (!cancelled) setUsedFallback(true);
          }
          gasStations = selectOnRouteFuelStations(gasStations, 1);
          gasStations = applyStopFilters(gasStations, answers);
          gasStations = filterStationsByPreferredBrand(gasStations, answers);
          gasStations = markBestPriceFuelStations(gasStations, apiMode);
          collected.push(...gasStations.map(s => ({
            ...s,
            cardType: apiMode === "diesel" ? "diesel" : "gas",
            estimated: s.estimated !== false,
            livePrices: s.livePrices === true,
          })));
        }

        if (mode === "rv") {
          const [googleGas, googleDiesel] = await Promise.all([
            searchGasStations(lat, lng, 10),
            searchDieselStations(lat, lng, 10),
          ]);
          const [gasRes, dieselRes] = await Promise.all([
            googleGas.length ? enrichFuelStations(googleGas, "gas") : { stations: [], fallback: true },
            googleDiesel.length ? enrichFuelStations(googleDiesel, "diesel") : { stations: [], fallback: true },
          ]);
          let gasStations = gasRes.stations?.length ? gasRes.stations : buildFallbackGasStations(lat, lng, "gas");
          let dieselStations = dieselRes.stations?.length ? dieselRes.stations : buildFallbackGasStations(lat, lng, "diesel");
          gasStations = selectOnRouteFuelStations(applyStopFilters(gasStations, answers), 1);
          dieselStations = selectOnRouteFuelStations(applyStopFilters(dieselStations, answers), 1);
          gasStations = filterStationsByPreferredBrand(gasStations, answers);
          dieselStations = filterStationsByPreferredBrand(dieselStations, answers);
          gasStations = markBestPriceFuelStations(gasStations, "gas");
          dieselStations = markBestPriceFuelStations(dieselStations, "diesel");
          if (gasRes.fallback || dieselRes.fallback) {
            if (!cancelled) setUsedFallback(true);
          }
          collected.push(...gasStations.map(s => ({
            ...s,
            cardType: "gas",
            estimated: s.estimated !== false,
            livePrices: s.livePrices === true,
          })));
          collected.push(...dieselStations.map(s => ({
            ...s,
            cardType: "diesel",
            estimated: s.estimated !== false,
            livePrices: s.livePrices === true,
          })));
        }

        if (mode === "ev" || mode === "hybrid") {
          const teslaOnly = isTeslaSuperchargerOnly(answers);
          const nrelRes = await discoverEvCharging(lat, lng, { teslaOnly, fuelType: "ELEC", radius: 5 });
          let evStations = nrelRes.stations || [];
          if (!evStations.length) {
            const googleEv = await searchEvChargingStations(lat, lng, 10);
            if (googleEv.length) {
              const evRes = await enrichEvCharging(googleEv, "ELEC", { teslaOnly });
              evStations = evRes.stations || googleEv;
              if (evRes.fallback && !cancelled) setUsedFallback(true);
            } else {
              evStations = buildFallbackEvStations(lat, lng);
              if (!cancelled) setUsedFallback(true);
            }
          }
          evStations = evStations.filter(s => isPlausibleEvChargingStation(s));
          evStations = selectOnRouteFuelStations(applyStopFilters(evStations, answers), 1);
          collected.push(...evStations.map(s => ({ ...s, cardType: "ev" })));
        }

        if (mode === "rv") {
          const googlePropane = await searchPropaneStations(lat, lng);
          let propane = googlePropane;
          if (googlePropane.length) {
            const propaneRes = await enrichEvCharging(googlePropane, "LPG");
            propane = propaneRes.stations || googlePropane;
          } else {
            propane = buildFallbackPropane(lat, lng);
          }
          collected.push(...propane.map(s => ({ ...s, cardType: "propane" })));
        }

        if (!cancelled) {
          setCards(takeClosest(collected, 1));
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
