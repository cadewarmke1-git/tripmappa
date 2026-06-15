/** Brand logo fallbacks when Google Places photos are unavailable. */

const WIKI = "https://upload.wikimedia.org/wikipedia";

/**
 * Longest / most specific brand keys first so "Pilot Flying J" wins over "Pilot".
 * @type {{ keys: string[], url: string }[]}
 */
export const BRAND_PHOTO_ENTRIES = [
  { keys: ["pilot flying j", "flying j"], url: `${WIKI}/en/thumb/8/8a/Pilot_Flying_J_logo.svg/320px-Pilot_Flying_J_logo.svg.png` },
  { keys: ["love's travel", "loves travel stop", "loves travel", "love's", "loves"], url: `${WIKI}/en/thumb/8/8e/Love%27s_Travel_Stops_logo.svg/320px-Love%27s_Travel_Stops_logo.svg.png` },
  { keys: ["ta travel", "travelcenters of america", "travel centers of america"], url: `${WIKI}/en/thumb/4/4d/TA_Travel_Center_logo.svg/320px-TA_Travel_Center_logo.svg.png` },
  { keys: ["buc-ee", "bucees", "buc ee"], url: `${WIKI}/en/thumb/8/8f/Buc-ee%27s_logo.svg/320px-Buc-ee%27s_logo.svg.png` },
  { keys: ["raising cane", "raising canes"], url: `${WIKI}/en/thumb/4/4e/Raising_Cane%27s_Chicken_Fingers_logo.svg/320px-Raising_Cane%27s_Chicken_Fingers_logo.svg.png` },
  { keys: ["jack in the box"], url: `${WIKI}/en/thumb/4/4a/Jack_in_the_Box_logo.svg/320px-Jack_in_the_Box_logo.svg.png` },
  { keys: ["cracker barrel"], url: `${WIKI}/en/thumb/4/4c/Cracker_Barrel_Old_Country_Store_logo.svg/320px-Cracker_Barrel_Old_Country_Store_logo.svg.png` },
  { keys: ["waffle house"], url: `${WIKI}/en/thumb/7/7e/Waffle_House_logo.svg/320px-Waffle_House_logo.svg.png` },
  { keys: ["chick-fil-a", "chick fil a", "chickfila"], url: `${WIKI}/en/thumb/0/07/Chick-fil-A_Logo.svg/320px-Chick-fil-A_Logo.svg.png` },
  { keys: ["whataburger"], url: `${WIKI}/en/thumb/8/8d/Whataburger_logo.svg/320px-Whataburger_logo.svg.png` },
  { keys: ["burger king"], url: `${WIKI}/commons/thumb/c/cc/Burger_King_2020.svg/320px-Burger_King_2020.svg.png` },
  { keys: ["taco bell"], url: `${WIKI}/commons/thumb/b/b3/Taco_Bell_2016.svg/320px-Taco_Bell_2016.svg.png` },
  { keys: ["mcdonald"], url: `${WIKI}/commons/thumb/3/36/McDonald%27s_Golden_Arches.svg/320px-McDonald%27s_Golden_Arches.svg.png` },
  { keys: ["quiktrip", "quick trip"], url: `${WIKI}/en/thumb/4/4e/QuikTrip_logo.svg/320px-QuikTrip_logo.svg.png` },
  { keys: ["exxon"], url: `${WIKI}/commons/thumb/5/56/Exxon_logo.svg/320px-Exxon_logo.svg.png` },
  { keys: ["chevron"], url: `${WIKI}/commons/thumb/3/39/Chevron_logo.svg/320px-Chevron_logo.svg.png` },
  { keys: ["texaco"], url: `${WIKI}/commons/thumb/2/2e/Texaco_logo.svg/320px-Texaco_logo.svg.png` },
  { keys: ["mobil"], url: `${WIKI}/commons/thumb/2/24/Mobil_logo.svg/320px-Mobil_logo.svg.png` },
  { keys: ["shell"], url: `${WIKI}/en/thumb/e/e8/Shell_logo.svg/320px-Shell_logo.svg.png` },
  { keys: ["wendy"], url: `${WIKI}/commons/thumb/3/3b/Wendy%27s_full_logo_2012.svg/320px-Wendy%27s_full_logo_2012.svg.png` },
  { keys: ["subway"], url: `${WIKI}/commons/thumb/5/5c/Subway_2016_logo.svg/320px-Subway_2016_logo.svg.png` },
  { keys: ["sonic drive", "sonic"], url: `${WIKI}/commons/thumb/4/4d/Sonic_Drive-In_Logo.svg/320px-Sonic_Drive-In_Logo.svg.png` },
  { keys: ["denny"], url: `${WIKI}/commons/thumb/0/04/Denny%27s_logo.svg/320px-Denny%27s_logo.svg.png` },
  { keys: ["ihop"], url: `${WIKI}/commons/thumb/4/4f/IHOP_logo.svg/320px-IHOP_logo.svg.png` },
  { keys: ["bp"], url: `${WIKI}/en/thumb/d/d1/BP.svg/320px-BP.svg.png` },
];

/** Category photos when no Places photo and no brand match (Unsplash stable IDs). */
const CATEGORY_PHOTO_URLS = {
  fuel: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80&auto=format&fit=crop",
  food: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80&auto=format&fit=crop",
  general: "https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=400&q=80&auto=format&fit=crop",
};

/** @param {string} lower @param {string} key */
function nameIncludesBrand(lower, key) {
  const needle = key.toLowerCase();
  if (needle.length <= 4) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
  }
  return lower.includes(needle);
}

/** @param {string | null | undefined} name */
export function resolveBrandPhotoFallback(name) {
  const lower = String(name || "").toLowerCase();
  if (!lower) return null;
  for (const entry of BRAND_PHOTO_ENTRIES) {
    for (const key of entry.keys) {
      if (nameIncludesBrand(lower, key)) return entry.url;
    }
  }
  return null;
}

/** @param {string | null | undefined} category */
export function resolveCategoryPhotoFallback(category) {
  const cat = String(category || "").toLowerCase();
  if (/food|dining|restaurant|meal|coffee|cafe|breakfast|lunch|dinner/.test(cat)) {
    return CATEGORY_PHOTO_URLS.food;
  }
  if (/fuel|gas|rest|truck|charging|diesel|ev|service/.test(cat)) {
    return CATEGORY_PHOTO_URLS.fuel;
  }
  return CATEGORY_PHOTO_URLS.general;
}
