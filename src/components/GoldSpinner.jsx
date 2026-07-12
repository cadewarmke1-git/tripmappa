/** Small gold inline spinner — buttons and form submits only. Use PulsingWordmark for page/section loaders. */
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
