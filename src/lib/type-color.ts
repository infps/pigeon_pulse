// Resolve a display color for a race type. Prefers the admin-chosen color;
// falls back to a stable palette by id so types are always visually distinct
// even before anyone sets a color.
const PALETTE = [
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#dc2626", // red
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
  "#ea580c", // orange
  "#4f46e5", // indigo
];

export function resolveTypeColor(
  raceTypeId?: number | null,
  color?: string | null,
): string | null {
  if (color) return color;
  if (raceTypeId == null) return null;
  const i = ((raceTypeId % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i];
}

// Black/white text that stays readable on the given hex background.
export function textOn(bg: string): string {
  const h = bg.replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000000" : "#ffffff";
}
