const CHASE_BULB_COUNT = 9;
const HEX_TICK_COUNT = 6;

function FoodDecor() {
  return (
    <>
      <div className="vneon-deco vneon-starburst" aria-hidden="true" />
      <div className="vneon-deco vneon-diamonds" aria-hidden="true">
        <span className="vneon-diamond" />
        <span className="vneon-diamond" />
        <span className="vneon-diamond" />
        <span className="vneon-diamond" />
      </div>
    </>
  );
}

function FuelDecor() {
  return (
    <div className="vneon-deco vneon-hex-ticks" aria-hidden="true">
      {Array.from({ length: HEX_TICK_COUNT }, (_, i) => (
        <span key={i} className="vneon-hex-tick" />
      ))}
    </div>
  );
}

function LodgingDecor() {
  return (
    <div className="vneon-deco vneon-chase-bulbs" aria-hidden="true">
      {Array.from({ length: CHASE_BULB_COUNT }, (_, i) => (
        <span
          key={i}
          className="vneon-chase-bulb"
          style={{ "--bulb-i": i }}
        />
      ))}
    </div>
  );
}

function GeneralDecor() {
  return null;
}

const SHAPE_DECOR = {
  food: FoodDecor,
  fuel: FuelDecor,
  lodging: LodgingDecor,
  general: GeneralDecor,
};

/**
 * Vintage motel-sign shell for results stop cards.
 * Day/night rendering is driven by html[data-surface-theme] from the sky cycle.
 */
export default function VintageNeonSignCard({
  signCategory = "general",
  businessName,
  categoryLabel,
  photo = null,
  signExtra = null,
  infoRow = null,
  footer = null,
  variant = "card",
  className = "",
}) {
  const Decor = SHAPE_DECOR[signCategory] || GeneralDecor;
  const badge = categoryLabel || "Stop";
  const isPopup = variant === "popup";

  const signContent = isPopup ? (
    <>
      <h3 className="vneon-name">{businessName}</h3>
      <span className="vneon-cat-badge">{badge}</span>
    </>
  ) : (
    <>
      <span className="vneon-cat-badge">{badge}</span>
      {photo ? <div className="vneon-photo-slot">{photo}</div> : null}
      <h3 className="vneon-name">{businessName}</h3>
      {signCategory === "general" ? (
        <div className="vneon-deco vneon-name-rule" aria-hidden="true" />
      ) : null}
      {signExtra}
    </>
  );

  return (
    <div className={`vneon-card vneon-card--${signCategory}${isPopup ? " vneon-card--popup" : ""} ${className}`.trim()}>
      {!isPopup && (
        <div className="vneon-mount" aria-hidden="true">
          <span className="vneon-mount-bracket" />
          <span className="vneon-mount-pole" />
        </div>
      )}

      <div className="vneon-sign-shell">
        <div className="vneon-backing" aria-hidden="true" />
        <div className="vneon-tube vneon-tube-outer" aria-hidden="true" />
        <div className="vneon-tube vneon-tube-inner" aria-hidden="true" />
        <div className="vneon-shape">
          <Decor />
          <div className="vneon-sign-inner">{signContent}</div>
        </div>
      </div>

      {!isPopup && infoRow ? <div className="vneon-info-row">{infoRow}</div> : null}
      {!isPopup && footer ? <div className="vneon-footer">{footer}</div> : null}
    </div>
  );
}
