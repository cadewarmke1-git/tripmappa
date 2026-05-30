/** TripMappa brand wordmark — gradient applied via brand-typography.css */
export default function BrandWordmark({ className = "", as: Tag = "span", ...props }) {
  return (
    <Tag className={`brand-wordmark${className ? ` ${className}` : ""}`} {...props}>
      TripMappa
    </Tag>
  );
}
