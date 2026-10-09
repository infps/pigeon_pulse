export const FEDERATIONS = ["AU", "IF", "NPA", "CU", "BB", "ARPU", "IPB"];

export const COLORS = [
  "BB", "BC", "BBWF", "BBPD", "BCWF", "BCPD", "SPLA", "CHOC", "RC", "SIL",
  "RCSP", "RR", "BLK", "OPAL", "SLAT", "PENC", "WHIT", "GRIZ", "DC", "DCWF",
];

export const SEX_LABELS: Record<number, string> = { 0: "Unknown", 1: "Cock", 2: "Hen" };
export const SEX_LABELS_NEUTRAL: Record<number, string> = { 0: "Unknown", 1: "Male", 2: "Female" };

export function getSexLabel(sex: number | null | undefined, terminology: "traditional" | "neutral"): string {
  const map = terminology === "neutral" ? SEX_LABELS_NEUTRAL : SEX_LABELS;
  return map[sex ?? 0] ?? "Unknown";
}

/** Band letters may be any length when stored; tables/lists show the first 4. Detail views use the full value. */
export const BAND_LETTERS_LIST_LEN = 4;

/** Truncate the letters segment of a "FED-YEAR-LETTERS-NUMBER" band for list/table display. */
export function shortBand(band: string | null | undefined): string {
  if (!band) return "";
  const parts = band.split("-");
  if (parts.length < 4) return band;
  const letters = parts.slice(2, -1).join("-").slice(0, BAND_LETTERS_LIST_LEN);
  return [parts[0], parts[1], letters, parts[parts.length - 1]].join("-");
}
