import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seasonIdParam = searchParams.get("seasonId");

    const activeSeason = await prisma.season.findFirst({
      where: seasonIdParam
        ? { id: parseInt(seasonIdParam), eventId }
        : { eventId, isActive: true },
      orderBy: { startDate: "desc" },
      include: {
        feeScheme: { select: { name: true, feesCutPercent: true } },
        bettingScheme: { select: { name: true } },
        finalPrize: { select: { name: true, prizeSchemeItems: { select: { prizeValue: true } } } },
        hotSpot1Prize: { select: { name: true, prizeSchemeItems: { select: { prizeValue: true } } } },
        hotSpot2Prize: { select: { name: true, prizeSchemeItems: { select: { prizeValue: true } } } },
        hotSpot3Prize: { select: { name: true, prizeSchemeItems: { select: { prizeValue: true } } } },
        hotSpotAvgPrize: { select: { name: true, prizeSchemeItems: { select: { prizeValue: true } } } },
      },
    });

    const empty = {
      breederCount: 0,
      totalBirds: 0,
      activeBirds: 0,
      lostBirds: 0,
      injuredBirds: 0,
      foreignBirds: 0,
      totalCollected: 0,
      platformFee: 0,
      prizePool: 0,
      seasonName: null,
      feeSchemeName: null,
      bettingSchemeName: null,
      finalPrizeSchemeName: null,
      hotSpot1PrizeName: null,
      hotSpot2PrizeName: null,
      hotSpot3PrizeName: null,
      hotSpotAvgPrizeName: null,
      // new fields
      totalPerchFee: 0,
      reservedWaiting: 0,
      reservedBirds: 0,
      hereCount: 0,
      replacedCount: 0,
      entryFeeBirds: 0,
      entryFees: 0,
      entryRefund: 0,
      entryCommission: 0,
      entryTotalValue: 0,
      hotSpotBirds: 0,
      hotSpotFees: 0,
      hotSpotRefunds: 0,
      hotSpotCommission: 0,
      hotSpotValue: 0,
      totalBets: 0,
      betsRefund: 0,
      betsCommission: 0,
      betsValue: 0,
      paymentClasses: 0,
    };

    if (!activeSeason) return NextResponse.json(empty);

    const cutPct = activeSeason.feeScheme?.feesCutPercent ?? 0;

    // --- EventInventory aggregations ---
    const inventories = await prisma.eventInventory.findMany({
      where: { seasonId: activeSeason.id },
      select: { id: true, isWaiting: true, reservedBirds: true },
    });

    const inventoryIdList = inventories.map((i) => i.id);
    const breederCount = inventories.length;
    const reservedWaiting = inventories.filter((i) => i.isWaiting === 1).length;
    const reservedBirds = inventories.reduce((s, i) => s + (i.reservedBirds ?? 0), 0);

    // --- EventInventoryItem aggregations (single pass) ---
    const items = await prisma.eventInventoryItem.findMany({
      where: { eventInventoryId: { in: inventoryIdList } },
      select: {
        replacedItemId: true,
        entryFeeValue: true,
        entryRefund: true,
        perchFeeValue: true,
        hotSpotFeeValue: true,
        hotSpotRefund: true,
        raceFeeValue: true,
      },
    });

    let totalPerchFee = 0;
    let hereCount = 0;
    let replacedCount = 0;
    let entryFees = 0;
    let entryRefundSum = 0;
    let hotSpotFees = 0;
    let hotSpotRefunds = 0;
    let paymentClasses = 0;

    for (const item of items) {
      if (item.replacedItemId != null) {
        replacedCount++;
      } else {
        hereCount++;
      }
      totalPerchFee += item.perchFeeValue ?? 0;
      entryFees += item.entryFeeValue ?? 0;
      entryRefundSum += item.entryRefund ?? 0;
      hotSpotFees += item.hotSpotFeeValue ?? 0;
      hotSpotRefunds += item.hotSpotRefund ?? 0;
      paymentClasses += item.raceFeeValue ?? 0;
    }

    const entryCommission = entryFees * (cutPct / 100);
    const entryTotalValue = entryFees - entryRefundSum - entryCommission;
    const hotSpotCommission = hotSpotFees * (cutPct / 100);
    const hotSpotValue = hotSpotFees - hotSpotRefunds - hotSpotCommission;

    // --- RaceItem aggregations ---
    const raceItems = await prisma.raceItem.findMany({
      where: { race: { seasonId: activeSeason.id } },
      select: {
        isLost: true,
        status: true,
        inventoryItemId: true,
        displayStatus: { select: { trigger: true } },
      },
    });

    let lostBirds = 0;
    let foreignBirds = 0;
    let injuredBirds = 0;
    let activeBirds = 0;

    for (const ri of raceItems) {
      if (ri.isLost) {
        lostBirds++;
      } else if (ri.status === "FOREIGN_BIRD") {
        foreignBirds++;
      } else if (ri.displayStatus?.trigger === "INJURED") {
        injuredBirds++;
      } else {
        activeBirds++;
      }
    }

    const inventoryItemIdsInRaces = new Set(
      raceItems.map((r) => r.inventoryItemId).filter(Boolean)
    );
    const birdsNotInAnyRace = items.length - inventoryItemIdsInRaces.size;
    const totalBirdsCount = raceItems.length + birdsNotInAnyRace;
    activeBirds = activeBirds + birdsNotInAnyRace;

    // --- Payment aggregations ---
    const paymentsAgg = await prisma.payment.aggregate({
      where: { eventInventoryId: { in: inventoryIdList }, status: "PAID" },
      _sum: { paymentValue: true },
    });
    const totalCollected = paymentsAgg._sum.paymentValue ?? 0;
    const platformFee = totalCollected * (cutPct / 100);

    // --- Bet aggregations ---
    const betsPlacedAgg = await prisma.bet.aggregate({
      where: {
        race: { seasonId: activeSeason.id },
        status: { not: "REFUNDED" },
      },
      _sum: { amount: true },
    });
    const totalBets = betsPlacedAgg._sum.amount ?? 0;

    const betsRefundAgg = await prisma.bet.aggregate({
      where: {
        race: { seasonId: activeSeason.id },
        status: { in: ["WON", "PAID"] },
      },
      _sum: { payoutValue: true },
    });
    const betsRefund = betsRefundAgg._sum.payoutValue ?? 0;
    const betsCommission = totalBets * (cutPct / 100);
    const betsValue = totalBets - betsRefund - betsCommission;

    // --- Prize pool ---
    const prizeSchemes = [
      activeSeason.finalPrize,
      activeSeason.hotSpot1Prize,
      activeSeason.hotSpot2Prize,
      activeSeason.hotSpot3Prize,
      activeSeason.hotSpotAvgPrize,
    ].filter(Boolean);

    const seenNames = new Set<string>();
    let prizePool = 0;
    for (const scheme of prizeSchemes) {
      if (!scheme || seenNames.has(scheme.name!)) continue;
      seenNames.add(scheme.name!);
      prizePool += scheme.prizeSchemeItems.reduce((s, i) => s + (i.prizeValue ?? 0), 0);
    }

    return NextResponse.json({
      breederCount,
      totalBirds: totalBirdsCount,
      activeBirds,
      lostBirds,
      injuredBirds,
      foreignBirds,
      totalCollected,
      platformFee,
      prizePool,
      seasonName: activeSeason.name,
      feeSchemeName: activeSeason.feeScheme?.name ?? null,
      bettingSchemeName: activeSeason.bettingScheme?.name ?? null,
      finalPrizeSchemeName: activeSeason.finalPrize?.name ?? null,
      hotSpot1PrizeName: activeSeason.hotSpot1Prize?.name ?? null,
      hotSpot2PrizeName: activeSeason.hotSpot2Prize?.name ?? null,
      hotSpot3PrizeName: activeSeason.hotSpot3Prize?.name ?? null,
      hotSpotAvgPrizeName: activeSeason.hotSpotAvgPrize?.name ?? null,
      // new fields
      totalPerchFee,
      reservedWaiting,
      reservedBirds,
      hereCount,
      replacedCount,
      entryFeeBirds: items.length,
      entryFees,
      entryRefund: entryRefundSum,
      entryCommission,
      entryTotalValue,
      hotSpotBirds: items.length,
      hotSpotFees,
      hotSpotRefunds,
      hotSpotCommission,
      hotSpotValue,
      totalBets,
      betsRefund,
      betsCommission,
      betsValue,
      paymentClasses,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
