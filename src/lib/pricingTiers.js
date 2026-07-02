/** Pricing page display config — marketing copy + accent tokens (prices from tiers.js). */

import { formatTierPriceBlock, TIERS } from "./tiers.js";

export const PRICING_PLATE_TIERS = [
  {
    id: TIERS.WANDERER,
    name: "Wanderer",
    tag: "Free",
    accentVar: "--cat-general",
    allotment: "3 trips included",
    features: [
      "Full route planning",
      "Curated roadside stops",
      "Day & night map modes",
    ],
    cta: "Start free",
    primary: false,
  },
  {
    id: TIERS.VOYAGER,
    name: "Voyager",
    tag: "Most popular",
    accentVar: "--cat-fuel",
    allotment: "20 trips / month",
    features: [
      "Everything in Wanderer",
      "Verified stop ratings",
      "Save & revisit trips",
      "Priority routing",
    ],
    cta: "Choose Voyager",
    primary: true,
    ribbon: "Most popular",
  },
  {
    id: TIERS.TRAILBLAZER,
    name: "Trailblazer",
    tag: "Best value",
    accentVar: "--cat-food",
    allotment: "100 trips / month",
    features: [
      "Everything in Voyager",
      "Unlimited saved stops",
      "Offline route export",
      "Early access features",
    ],
    cta: "Choose Trailblazer",
    primary: false,
  },
];

export function getPlatePriceDisplay(tierId, billingInterval = "month") {
  const block = formatTierPriceBlock(tierId, billingInterval);
  if (tierId === TIERS.WANDERER) {
    return { price: "$0", per: "forever" };
  }
  if (billingInterval === "year" && block.billedAnnually) {
    return { price: block.primary, per: "avg / mo" };
  }
  const primary = block.primary || "$0";
  if (primary.includes("/")) {
    const [price, per] = primary.split("/");
    return { price, per: `/${per}` };
  }
  return { price: primary, per: "/mo" };
}
