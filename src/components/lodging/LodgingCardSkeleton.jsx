import PulsingWordmark from "../PulsingWordmark.jsx";

export default function LodgingCardSkeleton({ theme = "night" }) {
  return (
    <div className="lodging-card-loader" aria-hidden="true">
      <PulsingWordmark size="md" />
    </div>
  );
}
