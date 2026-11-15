/**
 * Class bets, as HayLoft keeps them: each class a bird is entered in is a flag
 * (1) on its event entry, priced by the season's betting scheme.
 *
 * Mirrors HayLoft's stored procedures:
 *   EVENT_INVENTORY_ITEM_BET_CALC — one bird's bets: Σ price of each flag = 1
 *   EVENT_BET_TOTALS              — event totals: only entries whose bets are
 *                                   active (IS_BET_ACTIVE <> 0); commission is
 *                                   the scheme's BETTING_CUT_PERCENT
 *   BIRD_BETS_REFUND_SET / EVENT_INVENTORY_ITEM_REPLACE — a refund or a
 *                                   replacement moves the bird's bets into
 *                                   BETS_REFUND and sets IS_BET_ACTIVE = 0
 */

export const BET_FLAGS = [
  ["belgianShowBet1", "belgianShow1"], ["belgianShowBet2", "belgianShow2"],
  ["belgianShowBet3", "belgianShow3"], ["belgianShowBet4", "belgianShow4"],
  ["belgianShowBet5", "belgianShow5"], ["belgianShowBet6", "belgianShow6"],
  ["belgianShowBet7", "belgianShow7"],
  ["standardShowBet1", "standardShow1"], ["standardShowBet2", "standardShow2"],
  ["standardShowBet3", "standardShow3"], ["standardShowBet4", "standardShow4"],
  ["standardShowBet5", "standardShow5"], ["standardShowBet6", "standardShow6"],
  ["wtaBet1", "wta1"], ["wtaBet2", "wta2"], ["wtaBet3", "wta3"], ["wtaBet4", "wta4"], ["wtaBet5", "wta5"],
] as const;

export type BetFlagField = (typeof BET_FLAGS)[number][0];
export type BetPriceField = (typeof BET_FLAGS)[number][1];

export type BetFlags = Partial<Record<BetFlagField, number | null>>;
export type BettingPrices = Partial<Record<BetPriceField, number | null>> & {
  bettingCutPercent?: number | null;
};

/** Prisma `select` for the flag columns of an EventInventoryItem. */
export const BET_FLAG_SELECT = Object.fromEntries(BET_FLAGS.map(([flag]) => [flag, true])) as Record<
  BetFlagField,
  true
>;

/** Prisma `select` for the price columns of a BettingScheme. */
export const BET_PRICE_SELECT = {
  ...(Object.fromEntries(BET_FLAGS.map(([, price]) => [price, true])) as Record<BetPriceField, true>),
  bettingCutPercent: true,
} as const;

/** One bird's class bets in dollars (EVENT_INVENTORY_ITEM_BET_CALC). A flag counts only when exactly 1. */
export function priceItemBets(item: BetFlags, scheme: BettingPrices | null | undefined): number {
  if (!scheme) return 0;
  let total = 0;
  for (const [flag, price] of BET_FLAGS) {
    if (item[flag] === 1) total += scheme[price] ?? 0;
  }
  return total;
}

/**
 * Whether a bird's bets count toward the event's totals. HayLoft creates every
 * entry with IS_BET_ACTIVE = 1 and clears it only on refund or replacement, so
 * a portal entry that never set it is active.
 */
export function betsActive(item: { isBetActive?: number | null }): boolean {
  return item.isBetActive == null || item.isBetActive !== 0;
}
