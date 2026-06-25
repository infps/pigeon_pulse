import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  computeBelgianPayouts,
  computeStandardPayouts,
  computeWtaPayouts,
  type PoolEntry,
} from "@/lib/betting-payout";

// POST /api/admin/race/[raceId]/betting/calculate-payouts
// Idempotent: computes payouts for all pools in a race and writes Bet.status/payoutValue
// + creates Payment type 3 (winner payout) per winning bet (if not already created).
// Race must be ENDED.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
      include: {
        event: {
          include: {
            bettingScheme: { include: { standardShowPercentages: true } },
          },
        },
      },
    });

    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });
    if (race.status !== "ENDED") {
      return NextResponse.json({ message: "Race must be ENDED before calculating payouts" }, { status: 400 });
    }

    const scheme = race.event?.bettingScheme;
    if (!scheme) {
      return NextResponse.json({ message: "No betting scheme assigned to this event" }, { status: 400 });
    }

    const cutPct = Number(scheme.bettingCutPercent ?? 0);
    const belgianRatio = Number(scheme.belgianRatio ?? 10);
    const standardPercentages = (scheme.standardShowPercentages ?? []).map((p) => ({
      place: p.place ?? 1,
      percValue: p.percValue ?? 0,
    }));

    // Load all bets for this race with their bird's arrival position
    const bets = await prisma.bet.findMany({
      where: { raceId: raceIdInt },
      include: {
        raceItem: { include: { result: true } },
      },
    });

    // Group into pools: (category, tierIndex)
    type PoolKey = string;
    const pools = new Map<PoolKey, typeof bets>();
    for (const bet of bets) {
      const key: PoolKey = `${bet.category}:${bet.tierIndex}`;
      if (!pools.has(key)) pools.set(key, []);
      pools.get(key)!.push(bet);
    }

    const allResults: {
      betId: number;
      category: string;
      tierIndex: number;
      bettorId: string;
      payoutValue: number;
      status: "WON" | "LOST" | "REFUNDED";
    }[] = [];

    for (const [key, poolBets] of pools) {
      const [category, tierIndexStr] = key.split(":");
      const tierIndex = parseInt(tierIndexStr);

      const entries: PoolEntry[] = poolBets.map((b) => ({
        betId: b.id,
        bettorId: b.bettorId,
        amount: b.amount,
        position: b.raceItem.result?.birdPosition ?? null,
      }));

      let payouts;
      if (category === "BELGIAN") {
        payouts = computeBelgianPayouts(entries, belgianRatio, cutPct);
      } else if (category === "STANDARD") {
        payouts = computeStandardPayouts(entries, cutPct, standardPercentages);
      } else {
        payouts = computeWtaPayouts(entries, cutPct);
      }

      for (const p of payouts) {
        allResults.push({ betId: p.betId, category, tierIndex, bettorId: p.bettorId, payoutValue: p.payoutValue, status: p.status });
      }
    }

    // Write results in a single transaction; skip already-paid bets (idempotent)
    await prisma.$transaction(async (tx) => {
      for (const r of allResults) {
        // Skip if already processed
        const existing = await tx.bet.findUnique({ where: { id: r.betId } });
        if (!existing || existing.status === "PAID") continue;

        await tx.bet.update({
          where: { id: r.betId },
          data: { status: r.status, payoutValue: r.status === "WON" ? r.payoutValue : r.payoutValue },
        });

        if (r.status === "WON" && r.payoutValue > 0) {
          await tx.payment.create({
            data: {
              paymentType: 3, // Winner payout
              paymentValue: r.payoutValue,
              paymentDate: new Date(),
              paymentDesc: `Betting payout: ${r.category} tier ${r.tierIndex}`,
              status: "PENDING",
              bettorId: r.bettorId,
            },
          });
        } else if (r.status === "REFUNDED") {
          await tx.payment.create({
            data: {
              paymentType: 3,
              paymentValue: r.payoutValue,
              paymentDate: new Date(),
              paymentDesc: `Bet refund: ${r.category} tier ${r.tierIndex} (pool below minimum)`,
              status: "PENDING",
              bettorId: r.bettorId,
            },
          });
        }
      }
    });

    const summary = {
      totalPools: pools.size,
      totalBets: bets.length,
      winners: allResults.filter((r) => r.status === "WON").length,
      refunded: allResults.filter((r) => r.status === "REFUNDED").length,
      totalPayout: allResults.reduce((s, r) => s + (r.status === "WON" ? r.payoutValue : 0), 0),
    };

    return NextResponse.json({ message: "Payouts calculated", summary });
  } catch (error) {
    console.error("Error calculating payouts:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
