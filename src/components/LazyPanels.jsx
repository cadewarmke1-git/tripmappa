import { lazy, Suspense } from "react";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";

const TripResultsPanel = lazy(() => import("./results/TripResultsPanel.jsx"));
const LiveViewPage = lazy(() => import("./live/LiveViewPage.jsx"));
const ProfilePage = lazy(() => import("./ProfilePage.jsx"));
const SharePanel = lazy(() => import("./SharePanel.jsx"));

export function PanelLoadingFallback({ theme = "night" }) {
  return (
    <div className="panel-loading-fallback" aria-busy="true">
      <RouteDrawingLoader theme={theme} variant="inline" />
    </div>
  );
}

export function LazyTripResultsPanel({ theme, ...props }) {
  return (
    <Suspense fallback={<PanelLoadingFallback theme={theme} />}>
      <TripResultsPanel {...props} />
    </Suspense>
  );
}

export function LazyLiveViewPage(props) {
  return (
    <Suspense fallback={<PanelLoadingFallback theme={props.theme || "night"} />}>
      <LiveViewPage {...props} />
    </Suspense>
  );
}

export function LazyProfilePage({ theme, ...props }) {
  return (
    <Suspense fallback={<PanelLoadingFallback theme={theme} />}>
      <ProfilePage {...props} />
    </Suspense>
  );
}

export function LazySharePanel({ theme, ...props }) {
  return (
    <Suspense fallback={<PanelLoadingFallback theme={theme} />}>
      <SharePanel {...props} />
    </Suspense>
  );
}
