/** Convoy pin colors — owner is always TripMappa gold. */

export const OWNER_COLOR = "#FFD28C";

export const CONVOY_PALETTE = [
  { id: "blue", hex: "#4A90D9", label: "Blue" },
  { id: "green", hex: "#48B87A", label: "Green" },
  { id: "purple", hex: "#9B72CF", label: "Purple" },
  { id: "coral", hex: "#FF7F6B", label: "Coral" },
  { id: "teal", hex: "#2EC4B6", label: "Teal" },
];

export function getConvoyColor(member) {
  return member?.color || CONVOY_PALETTE[0].hex;
}
