export const MIN_POOL_SIZE = 20;

export type PoolEntry = {
  betId: number;
  bettorId: string;
  amount: number;
  position: number | null; // null = DNF / not yet arrived
};

export type PayoutResult = {
  betId: number;
  bettorId: string;
  payoutValue: number;
  status: "WON" | "LOST" | "REFUNDED";
};

function net(pool: number, cutPct: number): number {
  return pool * (1 - cutPct / 100);
}

function byPosition(entries: PoolEntry[]): PoolEntry[] {
  return entries
    .filter((e) => e.position !== null)
    .sort((a, b) => (a.position as number) - (b.position as number));
}

export function computeWtaPayouts(
  entries: PoolEntry[],
  cutPct: number
): PayoutResult[] {
  if (entries.length < MIN_POOL_SIZE) {
    return entries.map((e) => ({
      betId: e.betId,
      bettorId: e.bettorId,
      payoutValue: e.amount,
      status: "REFUNDED",
    }));
  }
  const pool = entries.reduce((s, e) => s + e.amount, 0);
  const netAmount = net(pool, cutPct);
  const arrived = byPosition(entries);

  return entries.map((e) => {
    if (arrived.length > 0 && e.betId === arrived[0].betId) {
      return { betId: e.betId, bettorId: e.bettorId, payoutValue: netAmount, status: "WON" };
    }
    return { betId: e.betId, bettorId: e.bettorId, payoutValue: 0, status: "LOST" };
  });
}

export function computeStandardPayouts(
  entries: PoolEntry[],
  cutPct: number,
  percentages: { place: number; percValue: number }[]
): PayoutResult[] {
  if (entries.length < MIN_POOL_SIZE) {
    return entries.map((e) => ({
      betId: e.betId,
      bettorId: e.bettorId,
      payoutValue: e.amount,
      status: "REFUNDED",
    }));
  }
  const pool = entries.reduce((s, e) => s + e.amount, 0);
  const netAmount = net(pool, cutPct);
  const arrived = byPosition(entries);

  // Build betId → payout map by place
  const payoutMap = new Map<number, number>();
  const sorted = [...percentages].sort((a, b) => a.place - b.place);
  for (const pct of sorted) {
    const winner = arrived[pct.place - 1];
    if (winner) {
      payoutMap.set(winner.betId, (netAmount * pct.percValue) / 100);
    }
  }

  return entries.map((e) => {
    const payout = payoutMap.get(e.betId);
    if (payout !== undefined) {
      return { betId: e.betId, bettorId: e.bettorId, payoutValue: payout, status: "WON" };
    }
    return { betId: e.betId, bettorId: e.bettorId, payoutValue: 0, status: "LOST" };
  });
}

export function computeBelgianPayouts(
  entries: PoolEntry[],
  ratioR: number,
  cutPct: number
): PayoutResult[] {
  if (entries.length < MIN_POOL_SIZE) {
    return entries.map((e) => ({
      betId: e.betId,
      bettorId: e.bettorId,
      payoutValue: e.amount,
      status: "REFUNDED",
    }));
  }
  const n = entries.length;
  const winnerCount = Math.floor(n / ratioR);
  if (winnerCount === 0) {
    return entries.map((e) => ({
      betId: e.betId,
      bettorId: e.bettorId,
      payoutValue: e.amount,
      status: "REFUNDED",
    }));
  }
  const arrived = byPosition(entries);
  const winnerIds = new Set(arrived.slice(0, winnerCount).map((e) => e.betId));
  // Belgian prize = R × entry × (1 − cut%), same for each winner
  const entryAmount = entries[0]?.amount ?? 0;
  const prizePerWinner = ratioR * entryAmount * (1 - cutPct / 100);

  return entries.map((e) => {
    if (winnerIds.has(e.betId)) {
      return { betId: e.betId, bettorId: e.bettorId, payoutValue: prizePerWinner, status: "WON" };
    }
    return { betId: e.betId, bettorId: e.bettorId, payoutValue: 0, status: "LOST" };
  });
}
