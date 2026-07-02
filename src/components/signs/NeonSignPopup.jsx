import { useId } from "react";
import { parseRating } from "../../lib/ratings.js";

const CREAM = "#F1E2BE";
const CREAM_TEXT = "#FBEFD2";
const NIGHT_FACE = "#221224";
const DAY_TEXT = "#33261a";
const WARM_SHADOW = "rgba(120, 78, 30, 0.3)";

const VIEW_W = 280;
const VIEW_H = 168;

/** TripMappa category palette — shapes/colors per DESIGN.md neon spec. */
export const NEON_CATEGORIES = {
  food: { label: "Café", color: "#ff5fa8", shape: "oval", icon: "utensils" },
  fuel: { label: "Gas", color: "#3dd9d0", shape: "hexagon", icon: "fuel" },
  lodging: { label: "Motel", color: "#FFD28C", shape: "marquee", icon: "bed" },
  general: { label: "Route 66", color: "#5a9e96", shape: "rounded", icon: "wrench" },
};

const BOLTS = {
  oval: [[56, 40], [224, 40], [224, 128], [56, 128]],
  hexagon: [[60, 22], [220, 22], [220, 146], [60, 146]],
  marquee: [[26, 44], [206, 44], [206, 124], [26, 124]],
  rounded: [[28, 44], [252, 44], [252, 124], [28, 124]],
};

function CategoryIcon({ name }) {
  const common = { className: "neon-sign-popup-icon", "aria-hidden": true };
  switch (name) {
    case "utensils":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2M7 2v20M17 2v7a4 4 0 004 4h0v11" />
        </svg>
      );
    case "fuel":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 22V8l4-2 4 2v14M7 14h2M11 14h2M9 6V4" />
          <path d="M14 22V10l4-2 2 4v10h-6z" />
        </svg>
      );
    case "bed":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 4v16M2 8h18a2 2 0 012 2v10M2 17h20M6 8v9" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "nav":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 11l19-9-9 19-2-8-8-2z" strokeLinejoin="round" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      );
    default:
      return null;
  }
}

function shapeElement(shape, props) {
  switch (shape) {
    case "oval":
      return <ellipse cx={140} cy={84} rx={134} ry={78} {...props} />;
    case "hexagon":
      return <polygon points="50,8 230,8 272,84 230,160 50,160 8,84" {...props} />;
    case "marquee":
      return <polygon points="8,30 222,30 272,84 222,138 8,138" {...props} />;
    default:
      return <rect x={8} y={26} width={264} height={116} rx={20} {...props} />;
  }
}

function Bolt({ x, y, isNight }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={3.4}
        fill={isNight ? "#0b0a12" : "#b59a63"}
        stroke={isNight ? "#3a3550" : "#8a713f"}
        strokeWidth={0.8}
      />
      <line
        x1={x - 1.8}
        y1={y - 1.8}
        x2={x + 1.8}
        y2={y + 1.8}
        stroke={isNight ? "#25223a" : "#6f5a30"}
        strokeWidth={0.8}
        strokeLinecap="round"
      />
      <circle cx={x - 0.9} cy={y - 0.9} r={0.7} fill={isNight ? "#4a4668" : "#e8d7a8"} />
    </g>
  );
}

function ActionButton({ icon, label, mode, color, primary, onClick, href }) {
  const isNight = mode === "night";
  let bg;
  let fg;
  let border;
  if (primary) {
    bg = color;
    fg = "#181019";
    border = color;
  } else if (isNight) {
    bg = "rgba(255,255,255,0.05)";
    fg = CREAM_TEXT;
    border = "rgba(255,255,255,0.14)";
  } else {
    bg = "rgba(51,38,26,0.04)";
    fg = DAY_TEXT;
    border = "rgba(51,38,26,0.14)";
  }

  const className = `neon-sign-popup-btn${primary ? " neon-sign-popup-btn--primary" : ""}`;
  const style = {
    backgroundColor: bg,
    color: fg,
    border: `1px solid ${border}`,
    boxShadow: primary && isNight ? `0 0 10px ${color}66` : "none",
  };

  const content = (
    <>
      <CategoryIcon name={icon} />
      {label}
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={className} style={style} onClick={onClick}>
      {content}
    </button>
  );
}

export function NeonSign({
  business,
  mode,
  rating = null,
  verified = false,
}) {
  const config = NEON_CATEGORIES[business.category] || NEON_CATEGORIES.general;
  const isNight = mode === "night";
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  const clipId = `clip-${uid}`;
  const grainId = `grain-${uid}`;
  const shineId = `shine-${uid}`;

  const nameColor = isNight ? CREAM_TEXT : DAY_TEXT;
  const faceColor = isNight ? NIGHT_FACE : CREAM;
  const tubeColor = config.color;
  const bulbColor = config.color;
  const parsedRating = parseRating(rating);

  const longestWord = business.name
    .split(/\s+/)
    .reduce((max, w) => Math.max(max, w.length), 0);
  const metric = Math.max(longestWord, business.name.length / 2.4);
  const nameFontSize = Math.round(Math.max(13, Math.min(26, 150 / metric)));

  const outerGlow = `drop-shadow(0 0 4px ${config.color}) drop-shadow(0 0 10px ${config.color}) drop-shadow(0 0 18px ${config.color})`;

  return (
    <div className="neon-sign-popup-sign-wrap">
      <div className="neon-sign-popup-sign-stage">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="neon-sign-popup-svg" aria-hidden="true">
          <defs>
            <clipPath id={clipId}>{shapeElement(config.shape, {})}</clipPath>
            <filter id={grainId}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <linearGradient id={shineId} x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={isNight ? 0.1 : 0.32} />
              <stop offset="40%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>

          {!isNight && shapeElement(config.shape, {
            fill: "#000000",
            opacity: 0.16,
            transform: "translate(0,4)",
            style: { filter: "blur(3px)" },
          })}

          {shapeElement(config.shape, { fill: faceColor })}

          <g clipPath={`url(#${clipId})`}>
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} filter={`url(#${grainId})`} opacity={isNight ? 0.06 : 0.1} />
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={`url(#${shineId})`} />
          </g>

          {isNight ? (
            <>
              {shapeElement(config.shape, {
                fill: "none",
                stroke: tubeColor,
                strokeWidth: 3,
                opacity: 0.9,
                style: { filter: outerGlow },
              })}
              {shapeElement(config.shape, {
                fill: "none",
                stroke: "#fff6ff",
                strokeWidth: 1,
                opacity: 0.95,
              })}
              {shapeElement(config.shape, {
                fill: "none",
                stroke: bulbColor,
                strokeWidth: 4,
                strokeLinecap: "round",
                strokeDasharray: "0.5 16",
                style: { filter: `drop-shadow(0 0 4px ${bulbColor})` },
              })}
            </>
          ) : (
            <>
              {shapeElement(config.shape, {
                fill: "none",
                stroke: config.color,
                strokeWidth: 2.5,
              })}
              {shapeElement(config.shape, {
                fill: "none",
                stroke: config.color,
                strokeWidth: 5,
                strokeLinecap: "round",
                strokeDasharray: "0.5 15",
              })}
              {shapeElement(config.shape, {
                fill: "none",
                stroke: "#fff8e8",
                strokeWidth: 2,
                strokeLinecap: "round",
                strokeDasharray: "0.5 15",
              })}
            </>
          )}

          {BOLTS[config.shape].map(([x, y]) => (
            <Bolt key={`${x}-${y}`} x={x} y={y} isNight={isNight} />
          ))}
        </svg>

        <div className="neon-sign-popup-sign-text">
          <span
            className="neon-sign-popup-cat-label"
            style={{
              color: config.color,
              filter: isNight ? `drop-shadow(0 0 4px ${config.color})` : "none",
            }}
          >
            <CategoryIcon name={config.icon} />
            {config.label}
          </span>
          <span
            className="neon-sign-popup-business-name"
            style={{
              fontSize: `${nameFontSize}px`,
              color: nameColor,
              textShadow: isNight
                ? `0 0 6px ${config.color}88, 0 0 2px rgba(251,239,210,0.5)`
                : "none",
            }}
          >
            {business.name}
          </span>
          {(parsedRating != null || verified) && (
            <p className="neon-sign-popup-meta">
              {parsedRating != null && (
                <span aria-label={`Rated ${parsedRating} out of 5`}>★ {parsedRating.toFixed(1)}</span>
              )}
              {parsedRating != null && verified && <span className="neon-sign-popup-meta-sep">·</span>}
              {verified && <span className="neon-sign-popup-verified">✓ Verified</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NeonSignPopup({
  business,
  mode = "night",
  rating = null,
  verified = false,
  websiteUrl = null,
  menuUrl = null,
  bookUrl = null,
  onNavigate,
  onChooseStay,
  actionsOnly = false,
}) {
  const isNight = mode === "night";
  const config = NEON_CATEGORIES[business.category] || NEON_CATEGORIES.general;

  const actions = [
    { icon: "nav", label: "Navigate", primary: true, onClick: onNavigate },
  ];
  if (websiteUrl) {
    actions.push({ icon: "globe", label: "Website", href: websiteUrl });
  }
  if (business.category === "food" && menuUrl) {
    actions.push({ icon: "utensils", label: "Menu", href: menuUrl });
  }
  if (business.category === "lodging") {
    actions.push({
      icon: "bed",
      label: "Choose stay",
      primary: false,
      onClick: onChooseStay,
      href: bookUrl || undefined,
    });
  }

  const sign = (
    <NeonSign business={business} mode={mode} rating={rating} verified={verified} />
  );

  if (actionsOnly) {
    return (
      <div className="neon-sign-popup-actions">
        {actions.map(a => (
          <ActionButton
            key={a.label}
            icon={a.icon}
            label={a.label}
            mode={mode}
            color={config.color}
            primary={a.primary}
            onClick={a.onClick}
            href={a.href}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`neon-sign-popup-card neon-sign-popup-card--${mode}`}
      style={{
        background: isNight
          ? "linear-gradient(180deg, #2a1533 0%, #1a1526 100%)"
          : "linear-gradient(180deg, #fdf2dc 0%, #f6e6c6 100%)",
        boxShadow: isNight ? "0 12px 34px rgba(0,0,0,0.55)" : `0 10px 24px ${WARM_SHADOW}`,
      }}
    >
      {sign}
      <div className="neon-sign-popup-actions">
        {actions.map(a => (
          <ActionButton
            key={a.label}
            label={a.label}
            icon={a.icon}
            mode={mode}
            color={config.color}
            primary={a.primary}
            onClick={a.onClick}
            href={a.href}
          />
        ))}
      </div>
    </div>
  );
}
