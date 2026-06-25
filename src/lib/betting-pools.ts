// Shared helpers to derive bettable pools + tier amounts from a BettingScheme.
// A "pool" = one funded tier (category + tierIndex with a positive entry amount).

export type BetCategory = "BELGIAN" | "STANDARD" | "WTA";
export type SchemePool = { category: BetCategory; tierIndex: number; amount: number };

const TIER_COUNTS: Record<BetCategory, number> = {
  BELGIAN: 7,
  STANDARD: 6,
  WTA: 5,
};

export function tierField(category: BetCategory, tierIndex: number): string {
  if (category === "BELGIAN") return `belgianShow${tierIndex}`;
  if (category === "STANDARD") return `standardShow${tierIndex}`;
  return `wta${tierIndex}`;
}

export function schemeTierAmount(
  scheme: Record<string, unknown> | null | undefined,
  category: BetCategory,
  tierIndex: number
): number {
  if (!scheme) return 0;
  return Number(scheme[tierField(category, tierIndex)] ?? 0) || 0;
}

export function schemePools(scheme: Record<string, unknown> | null | undefined): SchemePool[] {
  if (!scheme) return [];
  const pools: SchemePool[] = [];
  (["BELGIAN", "STANDARD", "WTA"] as BetCategory[]).forEach((category) => {
    for (let tierIndex = 1; tierIndex <= TIER_COUNTS[category]; tierIndex++) {
      const amount = schemeTierAmount(scheme, category, tierIndex);
      if (amount > 0) pools.push({ category, tierIndex, amount });
    }
  });
  return pools;
}

export function poolKey(p: { category: string; tierIndex: number }): string {
  return `${p.category}:${p.tierIndex}`;
}
