import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// GET /api/admin/race/[raceId]/betting/pool
// Admin view: all betting pools for a race — who bet, amounts in, payouts owed.
export async function GET(
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

    const race = await prisma.race.findUnique({ where: { id: raceIdInt } });
    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });

    const bets = await prisma.bet.findMany({
      where: { raceId: raceIdInt },
      include: {
        bettor: { select: { id: true, name: true, lastName: true, email: true } },
        raceItem: {
          include: {
            result: { select: { birdPosition: true, arrivalTime: true } },
            inventoryItem: {
              include: {
                bird: { select: { band: true, band1: true, band2: true, band3: true, band4: true } },
                eventInventory: {
                  include: {
                    breeder: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ category: "asc" }, { tierIndex: "asc" }, { createdAt: "asc" }],
    });

    type PoolEntry = {
      betId: number;
      bettorId: string;
      bettorName: string;
      bettorEmail: string;
      raceItemId: number;
      band: string | null;
      ownerUserId: string | null;
      ownerName: string | null;
      position: number | null;
      amountIn: number;
      status: string;
      payoutValue: number | null;
      stakePaymentId: number | null;
      stakePaid: boolean;
    };

    type Pool = {
      category: string;
      tierIndex: number;
      totalIn: number;
      entries: PoolEntry[];
    };

    const stakeIds = bets.flatMap((b) => b.stakePaymentId ? [b.stakePaymentId] : []);
    const paidPayments = stakeIds.length > 0
      ? await prisma.payment.findMany({ where: { id: { in: stakeIds }, status: "PAID" }, select: { id: true } })
      : [];
    const paidSet = new Set(paidPayments.map((p) => p.id));

    const poolMap = new Map<string, Pool>();

    for (const bet of bets) {
      const key = `${bet.category}:${bet.tierIndex}`;
      if (!poolMap.has(key)) {
        poolMap.set(key, { category: bet.category, tierIndex: bet.tierIndex, totalIn: 0, entries: [] });
      }
      const pool = poolMap.get(key)!;
      pool.totalIn += bet.amount;

      const bird = bet.raceItem.inventoryItem?.bird;
      const band =
        [bird?.band1, bird?.band2, bird?.band3, bird?.band4].filter(Boolean).join("-") ||
        bird?.band ||
        null;
      const breeder = bet.raceItem.inventoryItem?.eventInventory?.breeder;
      const ownerName = breeder
        ? `${breeder.firstName ?? ""} ${breeder.lastName ?? ""}`.trim()
        : null;

      pool.entries.push({
        betId: bet.id,
        bettorId: bet.bettorId,
        bettorName: `${bet.bettor.name ?? ""} ${bet.bettor.lastName ?? ""}`.trim(),
        bettorEmail: bet.bettor.email,
        raceItemId: bet.raceItemId,
        band,
        ownerUserId: bet.ownerUserId,
        ownerName,
        position: bet.raceItem.result?.birdPosition ?? null,
        amountIn: bet.amount,
        status: bet.status,
        payoutValue: bet.payoutValue,
        stakePaymentId: bet.stakePaymentId,
        stakePaid: bet.stakePaymentId !== null && paidSet.has(bet.stakePaymentId),
      });
    }

    const pools = Array.from(poolMap.values()).map((p) => ({
      ...p,
      totalPayout: p.entries.reduce((s, e) => s + (e.payoutValue ?? 0), 0),
    }));

    return NextResponse.json({
      raceId: raceIdInt,
      bettingOpen: race.bettingOpen,
      raceStatus: race.status,
      pools,
      totals: {
        totalBets: bets.length,
        totalIn: pools.reduce((s, p) => s + p.totalIn, 0),
        totalPayout: pools.reduce((s, p) => s + p.totalPayout, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching betting pool:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
