/**
 * Class-bet winnings (RACE_BETS_CALC) and a registration's bets total
 * (INVENTORY_BETS_CALC), HayLoft's rules including its quirks.
 * Run: bun test tests/
 */
import { describe, expect, test } from "bun:test";
import { inventoryBetsU, raceBetWinningsU, type FinalRaceEntry } from "@/lib/hayloft-account";

const U = 10_000; // results are in ten-thousandths
const entry = (id: number, position: number | null, flags: Record<string, number>, drop: number | null = null, active = 1): FinalRaceEntry => ({
  raceItemId: id,
  inventoryItemId: 100 + id,
  position,
  arrivalTime: position == null ? null : new Date(2025, 0, 1, 10, position),
  drop,
  item: { ...flags, isBetActive: active },
});
const win = (m: Map<number, { total: number }>, id: number) => (m.get(id)?.total ?? 0) / U;

describe("INVENTORY_BETS_CALC", () => {
  test("flag × price, and WTA 5 left out of the total as HayLoft does", () => {
    const s = { wta1: 50, wta5: 999, belgianShow1: 20 };
    expect(inventoryBetsU([{ wtaBet1: 1, wtaBet5: 1, belgianShowBet1: 1 }], s) / U).toBe(70);
  });
});

describe("RACE_BETS_CALC", () => {
  test("Belgian Show pays 10 × the class price in finishing order until the pool (less cut) runs out", () => {
    // 3 birds bet Belgian 1 at $20, no cut: pool $60. 1st takes $200 → capped at $60.
    const s = { belgianShow1: 20, bettingCutPercent: 0 };
    const es = [entry(1, 1, { belgianShowBet1: 1 }), entry(2, 2, { belgianShowBet1: 1 }), entry(3, null, { belgianShowBet1: 1 })];
    const w = raceBetWinningsU(es, es.map((e) => e.item), s);
    expect([win(w, 1), win(w, 2), win(w, 3)]).toEqual([60, 0, 0]);
  });

  test("the betting cut comes off the pool first", () => {
    // 10 birds at $50 WTA, 15% cut: pool $500 − $75 = $425, all to the first placed bird.
    const s = { wta1: 50, bettingCutPercent: 15 };
    const es = Array.from({ length: 10 }, (_, i) => entry(i + 1, i + 1, { wtaBet1: 1 }));
    const w = raceBetWinningsU(es, es.map((e) => e.item), s);
    expect(win(w, 1)).toBe(425);
    expect(win(w, 2)).toBe(0);
  });

  test("Belgian Show 7 never pays (HayLoft empties its pool before checking it)", () => {
    const s = { belgianShow7: 20, bettingCutPercent: 0 };
    const es = [entry(1, 1, { belgianShowBet7: 1 }), entry(2, 2, { belgianShowBet7: 1 })];
    const w = raceBetWinningsU(es, es.map((e) => e.item), s);
    expect(win(w, 1) + win(w, 2)).toBe(0);
  });

  test("Standard Show pays the place percentages of the pool", () => {
    // 4 × $50 = $200 pool, no cut; places 1/2 get 60% / 40%.
    const s = { standardShow1: 50, bettingCutPercent: 0, standardShowPercentages: [{ place: 1, percValue: 60 }, { place: 2, percValue: 40 }] };
    const es = [1, 2, 3, 4].map((p) => entry(p, p, { standardShowBet1: 1 }));
    const w = raceBetWinningsU(es, es.map((e) => e.item), s);
    expect([win(w, 1), win(w, 2), win(w, 3), win(w, 4)]).toEqual([120, 80, 0, 0]);
  });

  test("birds in the same drop share each class equally", () => {
    // WTA pool $100 goes to the first bird; it shares drop 7 with the second → $50 each.
    const s = { wta1: 50, bettingCutPercent: 0 };
    const es = [entry(1, 1, { wtaBet1: 1 }, 7), entry(2, 2, { wtaBet1: 1 }, 7)];
    const w = raceBetWinningsU(es, es.map((e) => e.item), s);
    expect([win(w, 1), win(w, 2)]).toEqual([50, 50]);
  });

  test("inactive bets neither feed the pool nor win", () => {
    const s = { wta1: 50, bettingCutPercent: 0 };
    const es = [entry(1, 1, { wtaBet1: 1 }, null, 0), entry(2, 2, { wtaBet1: 1 })];
    const w = raceBetWinningsU(es, es.map((e) => e.item), s);
    expect([win(w, 1), win(w, 2)]).toEqual([0, 50]);
  });
});
