import { useEffect, useMemo, useRef, useState } from "react";
import { createItineraryShareLink, loadSharedItinerary } from "../lib/itineraryShare.js";
import { applySharePageMeta } from "../lib/itineraryShareApi.js";
import { copyToClipboard } from "../lib/copyToClipboard.js";
import { stopsToMapMarkers } from "../lib/mapMarkers.js";
import { stripSessionOnlyAnswers } from "../lib/tripHandlers.js";
import { formatCollaborationHints } from "../lib/collaborationHints.js";
import { parseLiveShareToken } from "../lib/liveShareApi.js";

/**
 * Share / collaborate / live-share orchestration for App.
 * Trip state setters are injected; toast/generateTrip via refs to avoid hook-order issues.
 */
export function useShare({
  user,
  session,
  openAuthModal,
  toastFnRef,
  generateTripRef,
  origin,
  dest,
  stops,
  roadStops,
  tripTips,
  answers,
  routeInfo,
  selectedLodging,
  personalTouches,
  changesMade,
  setView,
  setOrigin,
  setDest,
  setStops,
  setRoadStops,
  setTripTips,
  setPersonalTouches,
  setChangesMade,
  setAnswers,
  setSelectedLodging,
  setRouteInfo,
  setGenerated,
  setResultsView,
  setConvoComplete,
  setTab,
  setMapMarkers,
}) {
  const [shareViewMode, setShareViewMode] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("share"),
  );
  const [liveSharingActive, setLiveSharingActive] = useState(false);
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [activeCollaboration, setActiveCollaboration] = useState(null);
  const collaborationHintsRef = useRef("");
  const liveShareToken = useMemo(() => parseLiveShareToken(), []);

  function toast_(msg, options) {
    toastFnRef.current?.(msg, options);
  }

  async function handleShareItinerary() {
    const link = await createItineraryShareLink({
      origin, dest, stops, roadStops, tripTips, answers, routeInfo, selectedLodging,
      personalTouches, changesMade,
    }, session?.access_token || null);
    if (!link) {
      toast_("Could not create share link", { isError: true });
      return;
    }
    const { ok } = await copyToClipboard(link);
    if (ok) toast_("Trip link copied — anyone can view your itinerary", true);
    else toast_("Could not copy — open Share and copy the link manually.", { isError: true, duration: 8000 });
  }

  function handleOpenCollaborate() {
    if (!user) {
      openAuthModal("signup");
      return;
    }
    setShowCollabPanel(true);
  }

  function handleRegenerateWithGroup(collaboration) {
    collaborationHintsRef.current = formatCollaborationHints(collaboration, stops);
    setShowCollabPanel(false);
    toast_("Regenerating trip with group input…");
    const run = generateTripRef.current;
    if (typeof run === "function") {
      void Promise.resolve(run()).finally(() => {
        collaborationHintsRef.current = "";
      });
    } else {
      collaborationHintsRef.current = "";
    }
  }

  const tripCollabSnapshot = useMemo(() => ({
    origin,
    dest,
    destination: dest,
    stops,
    roadStops,
    tripTips,
    answers,
    routeInfo,
    selectedLodging,
  }), [origin, dest, stops, roadStops, tripTips, answers, routeInfo, selectedLodging]);

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("share");
    if (!shareId) return;

    let cancelled = false;
    (async () => {
      let shared;
      try {
        shared = await loadSharedItinerary(shareId);
      } catch {
        if (!cancelled) {
          toast_("Could not load this trip link. It may have expired.", { isError: true, duration: 10000 });
        }
        return;
      }
      if (cancelled) return;
      if (!shared) {
        toast_("This trip link was not found or has expired.", { isError: true, duration: 10000 });
        return;
      }
      setView("app");
      setOrigin(shared.origin || "");
      setDest(shared.dest || "");
      setStops(shared.stops || []);
      setRoadStops(shared.roadStops || []);
      setTripTips(shared.tripTips || []);
      setPersonalTouches(shared.personalTouches || []);
      setChangesMade(shared.changesMade || []);
      setAnswers(stripSessionOnlyAnswers(shared.answers || {}));
      setSelectedLodging(shared.selectedLodging || []);
      if (shared.routeInfo) setRouteInfo(shared.routeInfo);
      setShareViewMode(true);
      setGenerated(true);
      setResultsView("itinerary");
      setConvoComplete(true);
      setTab("plan");
      setMapMarkers(stopsToMapMarkers(shared.stops || [], shared.roadStops || [], [], [], shared.answers || {}));
      applySharePageMeta({
        origin: shared.origin,
        dest: shared.dest,
        stopCount: shared.shareMeta?.stopCount ?? ((shared.stops?.length || 0) + (shared.roadStops?.length || 0)),
        dayCount: shared.shareMeta?.dayCount,
      });
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    shareViewMode,
    setShareViewMode,
    liveSharingActive,
    setLiveSharingActive,
    liveShareToken,
    showCollabPanel,
    setShowCollabPanel,
    activeCollaboration,
    setActiveCollaboration,
    collaborationHintsRef,
    handleShareItinerary,
    handleOpenCollaborate,
    handleRegenerateWithGroup,
    tripCollabSnapshot,
  };
}
