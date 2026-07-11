/** Simple gold loading spinner — use instead of RouteDrawingLoader outside generation. */
export default function GoldSpinner({ size = "md", className = "" }) {
  return (
    <span
      className={`spinner-gold spinner-gold--${size}${className ? ` ${className}` : ""}`}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    />
  );
}
