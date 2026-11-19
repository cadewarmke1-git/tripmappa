import { useEffect, useRef, useCallback } from "react";
import { updateConvoyLocation } from "../lib/liveShareApi.js";

const UPDATE_INTERVAL_MS = 30_000;

/** Broadcast convoy member GPS every 30s. */
export function useConvoyBroadcast({
  active,
  shareToken,
  memberId,
  locationSecret,
  onLocationUpdate,
  onError,
}) {
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const positionRef = useRef(null);
  const sendingRef = useRef(false);

  const sendUpdate = useCallback(async () => {
    const pos = positionRef.current;
    if (!shareToken || !memberId || !locationSecret || !pos || sendingRef.current) return;
    sendingRef.current = true;
    try {
      const result = await updateConvoyLocation({
        shareToken,
        memberId,
        locationSecret,
        latitude: pos.lat,
        longitude: pos.lng,
        speedMps: pos.speedMps,
      });
      onLocationUpdate?.(result);
    } catch (err) {
      onError?.(err);
    } finally {
      sendingRef.current = false;
    }
  }, [shareToken, memberId, locationSecret, onLocationUpdate, onError]);

  useEffect(() => {
    if (!active || !shareToken || !memberId || !locationSecret) return undefined;
    if (!navigator.geolocation) {
      onError?.(new Error("Geolocation is not supported"));
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        positionRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedMps: pos.coords.speed,
        };
      },
      err => onError?.(err),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );

    const kickoff = setTimeout(sendUpdate, 500);
    intervalRef.current = window.setInterval(sendUpdate, UPDATE_INTERVAL_MS);

    return () => {
      clearTimeout(kickoff);
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, shareToken, memberId, locationSecret, sendUpdate, onError]);

  return { sendUpdate };
}
