/**
 * Shared fee calculator — pure function, zero DB deps.
 * Used by both server (API routes) and client (UI components).
 */

export interface FeeCalcFeeScheme {
  entryFee: number | null;
  raceFeeMode: "PER_BIRD_PER_RACE" | "FLAT_PER_RACE";
  hotSpot1Fee: number | null;
  hotSpot2Fee: number | null;
  hotSpot3Fee: number | null;
  hotSpotFinalFee: number | null;
  birdFeeItems: { birdNo: number | null; birdFee: number | null }[];
  raceTypeFees: { raceTypeId: number; fee: number }[];
}

export interface FeeCalcRace {
  raceTypeId: number | null;
}

export interface FeeCalculationInput {
  numBirds: number;
  feeScheme: FeeCalcFeeScheme;
  races: FeeCalcRace[];
}

export interface PerBirdFees {
  position: number;
  perchFee: number;
  /** What the hotspot obligation costs if settled at each gate. */
  hotspot1Fee: number;
  hotspot2Fee: number;
  hotspot3Fee: number;
  hotspotFinalFee: number;
  /** Sum of the four gates. Kept for anything still reading the old shape. */
  hotspotFee: number;
}

export interface FeeBreakdown {
  purgeFee: number;
  perchFees: number;
  raceFees: number;
  hotspot1Fees: number;
  hotspot2Fees: number;
  hotspot3Fees: number;
  hotspotFinalFees: number;
  /** Sum of the four. Not what a breeder owes — see `hotspotDue`. */
  hotspotFees: number;
  /**
   * What the hotspot obligation actually costs, at the cheapest gate on offer.
   *
   * The four gate prices escalate — a real scheme in the legacy data runs
   * 200 / 400 / 800 — because they are four chances to settle one obligation,
   * not four separate charges. Summing them would bill a ten-bird entry
   * $14,000 against a $1,500 base, which is not what anybody was charged.
   */
  hotspotDue: number;
  total: number;
  perBirdBreakdown: PerBirdFees[];
}

/** The four hotspot gates, in the order they fall. */
export const HOTSPOT_GATES = ["HS1", "HS2", "HS3", "FINAL"] as const;
export type HotspotGate = (typeof HOTSPOT_GATES)[number];

/** Bit position of each gate in `EventInventory.hotspotsPaidMask`. */
export const GATE_BIT: Record<HotspotGate, number> = {
  HS1: 0,
  HS2: 1,
  HS3: 2,
  FINAL: 3,
};

/**
 * Has the hotspot obligation been settled?
 *
 * One obligation, four chances to pay it — so *any* bit set means settled, and
 * paying at one gate marks them all. The alternative reading, where each gate
 * is its own charge, is contradicted both by the escalating prices and by the
 * rule that a breeder who paid nothing earlier "must pay at Final": there would
 * be nothing to catch up on if each gate stood alone.
 */
export function hotspotSettled(mask: number): boolean {
  return mask !== 0;
}

/** Every gate marked, since settling at one settles the obligation. */
export const ALL_GATES_MASK = 0b1111;

/** What one bird owes at a given gate, from its stored per-gate values. */
export function gateAmount(
  item: {
    hotSpot1FeeValue?: number | null;
    hotSpot2FeeValue?: number | null;
    hotSpot3FeeValue?: number | null;
    hotSpotFinalFeeValue?: number | null;
  },
  gate: HotspotGate
): number {
  switch (gate) {
    case "HS1": return item.hotSpot1FeeValue ?? 0;
    case "HS2": return item.hotSpot2FeeValue ?? 0;
    case "HS3": return item.hotSpot3FeeValue ?? 0;
    case "FINAL": return item.hotSpotFinalFeeValue ?? 0;
  }
}

export function calculateFees(input: FeeCalculationInput): FeeBreakdown {
  const { numBirds, feeScheme, races } = input;

  // Purge Fee = 1-time flat fee (NOT per bird)
  const purgeFee = feeScheme.entryFee ?? 0;

  const hs1 = feeScheme.hotSpot1Fee ?? 0;
  const hs2 = feeScheme.hotSpot2Fee ?? 0;
  const hs3 = feeScheme.hotSpot3Fee ?? 0;
  const hsF = feeScheme.hotSpotFinalFee ?? 0;
  const hotspotPerBird = hs1 + hs2 + hs3 + hsF;

  // The cheapest gate that is actually priced. A scheme with only HS1 set
  // charges HS1; one that escalates charges the first, and missing it costs
  // more later.
  const duePerBird = [hs1, hs2, hs3, hsF].find((v) => v > 0) ?? 0;

  // Perch Fee = sum of graduated per-bird fees by position
  let perchFees = 0;
  const perBirdBreakdown: PerBirdFees[] = [];

  for (let i = 1; i <= numBirds; i++) {
    const item = feeScheme.birdFeeItems.find((b) => b.birdNo === i);
    const perchFee = item?.birdFee ?? 0;
    perchFees += perchFee;
    perBirdBreakdown.push({
      position: i,
      perchFee,
      hotspot1Fee: hs1,
      hotspot2Fee: hs2,
      hotspot3Fee: hs3,
      hotspotFinalFee: hsF,
      hotspotFee: hotspotPerBird,
    });
  }

  // Race Fees
  let raceFees = 0;
  for (const race of races) {
    if (!race.raceTypeId) continue;
    const rtFee = feeScheme.raceTypeFees.find(
      (rt) => rt.raceTypeId === race.raceTypeId
    );
    if (!rtFee) continue;
    if (feeScheme.raceFeeMode === "PER_BIRD_PER_RACE") {
      raceFees += rtFee.fee * numBirds;
    } else {
      raceFees += rtFee.fee;
    }
  }

  const hotspotFees = hotspotPerBird * numBirds;
  const hotspotDue = duePerBird * numBirds;

  return {
    purgeFee,
    perchFees,
    raceFees,
    hotspot1Fees: hs1 * numBirds,
    hotspot2Fees: hs2 * numBirds,
    hotspot3Fees: hs3 * numBirds,
    hotspotFinalFees: hsF * numBirds,
    hotspotFees,
    hotspotDue,
    // What is actually billed: one hotspot gate, not all four. Race fees are
    // no longer included here — they are charged per bird at basketing.
    total: purgeFee + perchFees + hotspotDue,
    perBirdBreakdown,
  };
}
