/** Top ~50 US restaurant chains by location count — used to prefer local spots in placesContext. */

export const TOP_US_RESTAURANT_CHAINS = [
  "McDonald's",
  "Subway",
  "Starbucks",
  "Dunkin'",
  "Burger King",
  "Taco Bell",
  "Domino's",
  "Pizza Hut",
  "Wendy's",
  "Chipotle",
  "Panera Bread",
  "Chick-fil-A",
  "Sonic Drive-In",
  "KFC",
  "Arby's",
  "Dairy Queen",
  "Little Caesars",
  "Papa John's",
  "Jack in the Box",
  "Popeyes",
  "Panda Express",
  "Whataburger",
  "Culver's",
  "Zaxby's",
  "Raising Cane's",
  "Jimmy John's",
  "Jersey Mike's",
  "Firehouse Subs",
  "Five Guys",
  "In-N-Out Burger",
  "Carl's Jr",
  "Hardee's",
  "Checkers",
  "Rally's",
  "Bojangles",
  "Del Taco",
  "White Castle",
  "Qdoba",
  "Moe's Southwest Grill",
  "Noodles & Company",
  "Potbelly Sandwich Shop",
  "Steak 'n Shake",
  "Buffalo Wild Wings",
  "Applebee's",
  "Chili's Grill & Bar",
  "Olive Garden",
  "IHOP",
  "Denny's",
  "Waffle House",
  "Cracker Barrel",
];

const CHAIN_ALIASES = [
  ["mcdonald", "mcdonalds"],
  ["burger king", "bk"],
  ["taco bell"],
  ["pizza hut"],
  ["little caesar", "little caesars"],
  ["papa john", "papa johns"],
  ["jack in the box"],
  ["sonic", "sonic drive in"],
  ["chick fil a", "chickfila"],
  ["raising cane", "raising canes"],
  ["jersey mike", "jersey mikes"],
  ["firehouse sub"],
  ["in n out"],
  ["carl jr", "carls jr"],
  ["hardee"],
  ["moe southwest", "moes"],
  ["noodles company"],
  ["potbelly"],
  ["steak n shake"],
  ["buffalo wild wings", "bww"],
  ["chili grill", "chilis"],
  ["olive garden"],
  ["cracker barrel"],
];

function normalizeChainToken(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const CHAIN_PATTERNS = [
  ...TOP_US_RESTAURANT_CHAINS.map(normalizeChainToken),
  ...CHAIN_ALIASES.flat(),
].filter(Boolean);

const NATIONAL_CHAIN_RE = new RegExp(
  `\\b(${CHAIN_PATTERNS.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")).join("|")})\\b`,
  "i",
);

export function isNationalChainPlace(place) {
  const blob = `${place?.name || ""} ${place?.address || ""}`;
  return NATIONAL_CHAIN_RE.test(blob);
}
