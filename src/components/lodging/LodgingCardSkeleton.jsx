import GoldSpinner from "../GoldSpinner.jsx";

export default function LodgingCardSkeleton({ theme = "night" }) {
  return (
    <div className="lodging-card-loader" aria-hidden="true">
      <GoldSpinner size="md" />
    </div>
  );
}
