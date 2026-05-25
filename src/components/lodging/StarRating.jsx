export default function StarRating({ stars, max = 5 }) {
  return (
    <div className="lodging-stars" aria-label={`${stars} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`lodging-star${i < stars ? " filled" : ""}`}>★</span>
      ))}
    </div>
  );
}
