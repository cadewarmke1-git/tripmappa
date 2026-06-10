/** Subscription tiers — single source of truth for client UI and feature gates. */

export const TIERS = {
  WANDERER: "wanderer",
  VOYAGER: "voyager",
  TRAILBLAZER: "trailblazer",
  FOUNDER: "founder",
};

/** Display order low → high (Founder shares Trailblazer feature rank) */
export const TIER_ORDER = [TIERS.WANDERER, TIERS.VOYAGER, TIERS.TRAILBLAZER];

const LEGACY_TIER_MAP = {
  free: TIERS.WANDERER,
  wanderer: TIERS.WANDERER,
  premium: TIERS.TRAILBLAZER,
  trailblazer: TIERS.TRAILBLAZER,
  traveler: TIERS.VOYAGER,
  voyager: TIERS.VOYAGER,
  founder: TIERS.FOUNDER,
};

export const TIER_PRICING = {
  [TIERS.WANDERER]: {
    label: "Wanderer",
    priceLabel: "Free",
    priceMonthly: 0,
    upgradeUrl: null,
  },
  [TIERS.VOYAGER]: {
    label: "Voyager",
    priceLabel: "$4.99/mo",
    priceMonthly: 4.99,
    priceAnnual: 39.99,
    priceAnnualLabel: "$39.99/yr",
    upgradeUrl: null,
  },
  [TIERS.TRAILBLAZER]: {
    label: "Trailblazer",
    priceLabel: "$9.99/mo",
    priceMonthly: 9.99,
    priceAnnual: 79.99,
    priceAnnualLabel: "$79.99/yr",
    upgradeUrl: null,
  },
  [TIERS.FOUNDER]: {
    label: "Founder",
    priceLabel: "Founding 1,000",
    priceMonthly: 0,
    upgradeUrl: null,
  },
};

export const FOUNDER_MEMBER_LIMIT = 1000;

export const WANDERER_BENEFITS = [
  "3 Trip Generations total (lifetime)",
  "Saved trips & Navigate Home",
  "Full maps, routing & budget estimates",
];

export const VOYAGER_BENEFITS = [
  "20 Trip Generations per month",
  "Live location sharing",
  "Offline maps",
];

export const TRAILBLAZER_BENEFITS = [
  "100 Trip Generations per month",
  "Everything in Voyager",
  "Grocery delivery to your hotel",
  "Priority generation queue",
  "Voice-to-list grocery ordering",
];

export const FOUNDER_BENEFITS = [
  "1 year of Trailblazer — free",
  "Limited to the first 1,000 members",
  "Permanent Founder badge on your profile",
  "All Trailblazer features while active",
];

/** Rows for the tier comparison table — single source for pricing UI. */
export const TIER_FEATURE_COMPARISON = [
  { id: "generations", label: "Trip generations", wanderer: "3 total", voyager: "20 / month", trailblazer: "100 / month", founder: "100 / month (1 yr)" },
  { id: "saved_trips", label: "Saved trips", wanderer: true, voyager: true, trailblazer: true, founder: true },
  { id: "live_share", label: "Live location sharing", wanderer: false, voyager: true, trailblazer: true, founder: true },
  { id: "offline_maps", label: "Offline maps", wanderer: false, voyager: true, trailblazer: true, founder: true },
  { id: "grocery", label: "Grocery delivery to hotel", wanderer: false, voyager: false, trailblazer: true, founder: true },
  { id: "priority", label: "Priority generation queue", wanderer: false, voyager: false, trailblazer: true, founder: true },
  { id: "voice_grocery", label: "Voice grocery ordering", wanderer: false, voyager: false, trailblazer: true, founder: true },
  { id: "founder_badge", label: "Founder badge", wanderer: false, voyager: false, trailblazer: false, founder: true },
];

export function formatTierPriceBlock(tier, billingInterval = "month") {
  const key = normalizeTier(tier);
  if (isFounderTier(tier)) {
    return {
      primary: "Free for 1 year",
      secondary: "Trailblazer access · limited offer",
      showSavings: false,
      billedAnnually: null,
    };
  }
  const pricing = TIER_PRICING[key];
  if (!pricing || pricing.priceMonthly === 0) {
    return { primary: "Free", secondary: null, showSavings: false, billedAnnually: null };
  }
  if (billingInterval === "year") {
    const monthlyEq = getTierAnnualMonthlyEquivalent(tier);
    return {
      primary: monthlyEq ? `$${monthlyEq}/mo` : getTierPriceLabel(tier, "year"),
      secondary: getTierPriceLabel(tier, "year"),
      showSavings: true,
      billedAnnually: getTierPriceLabel(tier, "year"),
    };
  }
  return {
    primary: getTierPriceLabel(tier),
    secondary: null,
    showSavings: false,
    billedAnnually: null,
  };
}

/** @deprecated use WANDERER_BENEFITS */
export const FREE_BENEFITS = WANDERER_BENEFITS;
/** @deprecated use TRAILBLAZER_BENEFITS */
export const PREMIUM_BENEFITS = TRAILBLAZER_BENEFITS;
/** @deprecated use TRAILBLAZER_BENEFITS */
export const TRAVELER_BENEFITS = TRAILBLAZER_BENEFITS;

export function normalizeTier(tier) {
  if (tier === "guest") return TIERS.WANDERER;
  if (!tier) return TIERS.WANDERER;
  return LEGACY_TIER_MAP[tier] || TIERS.WANDERER;
}

export function tierRank(tier) {
  const normalized = normalizeTier(tier);
  if (normalized === TIERS.FOUNDER) {
    return TIER_ORDER.indexOf(TIERS.TRAILBLAZER);
  }
  const idx = TIER_ORDER.indexOf(normalized);
  return idx >= 0 ? idx : 0;
}

export function isAtLeastTier(currentTier, requiredTier) {
  return tierRank(currentTier) >= tierRank(requiredTier);
}

export function isFounderTier(tier) {
  return tier === TIERS.FOUNDER;
}

export function getTierLabel(tier) {
  const key = normalizeTier(tier);
  if (isFounderTier(tier)) return TIER_PRICING[TIERS.FOUNDER].label;
  return TIER_PRICING[key]?.label || "Wanderer";
}

export function getTierPriceLabel(tier, billingPeriod = "month") {
  const key = normalizeTier(tier);
  if (isFounderTier(tier)) return TIER_PRICING[TIERS.FOUNDER].priceLabel;
  const pricing = TIER_PRICING[key];
  if (!pricing) return "Free";
  if (billingPeriod === "year" && pricing.priceAnnualLabel) return pricing.priceAnnualLabel;
  return pricing.priceLabel || "Free";
}

export function getTierAnnualMonthlyEquivalent(tier) {
  const key = normalizeTier(tier);
  const pricing = TIER_PRICING[key];
  if (!pricing?.priceAnnual) return null;
  return (pricing.priceAnnual / 12).toFixed(2);
}

export function hasUnlimitedTripGenerations(tier) {
  return isFounderTier(tier) || isAtLeastTier(tier, TIERS.VOYAGER);
}

export function canUseGroceryDelivery(tier) {
  return isFounderTier(tier) || isAtLeastTier(tier, TIERS.TRAILBLAZER);
}

/** Avatar corner star: founder, voyager, or trailblazer (paid tiers only). */
export function getAvatarTierBadge(tier) {
  if (isFounderTier(tier)) return "founder";
  const key = normalizeTier(tier);
  if (key === TIERS.TRAILBLAZER) return "trailblazer";
  if (key === TIERS.VOYAGER) return "voyager";
  return null;
}

export function getTierCssClass(tier) {
  const key = normalizeTier(tier);
  if (isFounderTier(tier)) return "founder";
  if (key === TIERS.TRAILBLAZER) return "trailblazer";
  if (key === TIERS.VOYAGER) return "voyager";
  return "wanderer";
}
