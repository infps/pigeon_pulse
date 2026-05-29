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
