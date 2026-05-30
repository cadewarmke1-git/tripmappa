import RouteDrawingLoader from "../RouteDrawingLoader.jsx";

export default function LodgingCardSkeleton({ theme = "night" }) {
  return (
    <div className="lodging-card-loader" aria-hidden="true">
      <RouteDrawingLoader theme={theme} variant="compact" />
    </div>
  );
}
