import { requireAnyPermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/admin/event-inventory/[id]/bets
// Every bet this registration's breeder placed (as bettor) in the registration's season.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventInventoryId: string }> }
) {
  const { eventInventoryId: param } = await params;
  const eventInventoryId = parseInt(param);
  if (isNaN(eventInventoryId)) {
    return NextResponse.json({ message: "Invalid event inventory ID" }, { status: 400 });
  }

  const guard = await requireAnyPermission(["breeders.view", "breeders.manage", "betting.view", "betting.manage"]);
  if ("error" in guard) return guard.error;

  try {
    const inv = await prisma.eventInventory.findUnique({
      where: { id: eventInventoryId },
      select: { seasonId: true, breeder: { select: { userId: true } } },
    });
    if (!inv) return NextResponse.json({ message: "Event inventory not found" }, { status: 404 });

    const userId = inv.breeder?.userId;
    if (!userId || inv.seasonId == null) return NextResponse.json({ bets: [] });

    const bets = await prisma.bet.findMany({
      where: { bettorId: userId, race: { seasonId: inv.seasonId } },
      include: {
        race: { select: { id: true, name: true, raceNumber: true } },
        raceItem: {
          select: {
            inventoryItem: {
              select: { bird: { select: { band: true, band1: true, band2: true, band3: true, band4: true } } },
            },
          },
        },
      },
      orderBy: [{ raceId: "asc" }, { category: "asc" }, { tierIndex: "asc" }],
    });

    const stakeIds = bets.flatMap((b) => (b.stakePaymentId ? [b.stakePaymentId] : []));
    const paid = stakeIds.length
      ? await prisma.payment.findMany({ where: { id: { in: stakeIds }, status: "PAID" }, select: { id: true } })
      : [];
    const paidSet = new Set(paid.map((p) => p.id));

    return NextResponse.json({
      bets: bets.map((b) => {
        const bird = b.raceItem.inventoryItem?.bird;
        return {
          id: b.id,
          raceId: b.race.id,
          raceName: b.race.name,
          raceNumber: b.race.raceNumber,
          category: b.category,
          tierIndex: b.tierIndex,
          band:
            [bird?.band1, bird?.band2, bird?.band3, bird?.band4].filter(Boolean).join("-") || bird?.band || null,
          amount: b.amount,
          stakePaid: b.stakePaymentId !== null && paidSet.has(b.stakePaymentId),
          status: b.status,
          payoutValue: b.payoutValue,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching breeder bets:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
