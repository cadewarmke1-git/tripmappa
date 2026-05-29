import { lazy, Suspense } from "react";

const TripResultsPanel = lazy(() => import("./results/TripResultsPanel.jsx"));
const LiveViewPage = lazy(() => import("./live/LiveViewPage.jsx"));
const ProfilePage = lazy(() => import("./ProfilePage.jsx"));
const SharePanel = lazy(() => import("./SharePanel.jsx"));

export function PanelLoadingFallback({ label = "Loading…" }) {
  return <div className="panel-loading-fallback" aria-busy="true">{label}</div>;
}

export function LazyTripResultsPanel(props) {
  return (
    <Suspense fallback={<PanelLoadingFallback label="Loading your trip…" />}>
      <TripResultsPanel {...props} />
    </Suspense>
  );
}

export function LazyLiveViewPage(props) {
  return (
    <Suspense fallback={<PanelLoadingFallback label="Loading live trip…" />}>
      <LiveViewPage {...props} />
    </Suspense>
  );
}

export function LazyProfilePage(props) {
  return (
    <Suspense fallback={<PanelLoadingFallback label="Loading profile…" />}>
      <ProfilePage {...props} />
    </Suspense>
  );
}

export function LazySharePanel(props) {
  return (
    <Suspense fallback={<PanelLoadingFallback label="Loading sharing…" />}>
      <SharePanel {...props} />
    </Suspense>
  );
}
