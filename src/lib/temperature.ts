// Race temperatures are stored in °C (Open-Meteo); UI shows °F.
export function cToF(c: string | number | null | undefined): string | null {
  if (c == null || c === "") return null;
  const n = typeof c === "number" ? c : parseFloat(c);
  if (!Number.isFinite(n)) return null;
  return `${Math.round((n * 9) / 5 + 32)}°F`;
}
