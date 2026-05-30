/** TripMappa brand wordmark — theme colors applied via CSS (brand-wordmark-* classes). */
export default function BrandWordmark({ className = "", as: Tag = "span", ...props }) {
  return (
    <Tag className={`brand-wordmark${className ? ` ${className}` : ""}`} {...props}>
      <span className="brand-wordmark-trip">Trip</span>
      <span className="brand-wordmark-mappa">Mappa</span>
    </Tag>
  );
}
