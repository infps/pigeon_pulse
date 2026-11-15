import { requirePermission } from "@/lib/authorize";
import { approvedItem, activeRaceItemOr } from "@/lib/entry-filters";
import { prisma } from "@/lib/prisma";
import { BET_PRICE_SELECT } from "@/lib/class-bets";
import { seasonAccounts } from "@/lib/hayloft-account";
import { NextResponse } from "next/server";

/**
 * The event Details screen: the same boxes and the same arithmetic as HayLoft's
 * Details screen, so the two can be compared figure by figure. The boxes are
 * totals of HayLoft's per-registration rows (lib/hayloft-account, a port of
 * EVENT_INVENTORY_GET), as HayLoft's own screen totals them. Checked against
 * HayLoft's AGN 2025 screen and, per registration, against HayLoft's procedure
 * output (scripts/hayloft-sync/reconcile-accounts.ts, reconcile-details.ts).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const guard = await requirePermission("events.view");
  if ("error" in guard) return guard.error;

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
        bettingScheme: { select: { name: true, ...BET_PRICE_SELECT } },
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
      paidPerchFee: 0,
      paidEntryFee: 0,
      paidHotSpot: 0,
      paidRegistration: 0,
      paymentClasses: 0,
    };

    if (!activeSeason) return NextResponse.json(empty);

    const cutPct = activeSeason.feeScheme?.feesCutPercent ?? 0;

    // --- HayLoft's registration rows (EVENT_INVENTORY_GET); the boxes are their totals ---
    // Independent reads, run together.
    const [{ accounts, bettingCutPercent }, foreignBirdRows, injuredRows, poolBetsAgg] = await Promise.all([
      seasonAccounts(activeSeason.id),
      prisma.raceItem.count({
        where: { race: { seasonId: activeSeason.id }, OR: activeRaceItemOr, status: "FOREIGN_BIRD" },
      }),
      // Birds counted once each, not once per race flown.
      prisma.raceItem.groupBy({
        by: ["inventoryItemId"],
        where: {
          race: { seasonId: activeSeason.id },
          OR: activeRaceItemOr,
          inventoryItemId: { not: null },
          displayStatus: { trigger: "INJURED" },
        },
      }),
      prisma.bet.aggregate({
        where: {
          race: { seasonId: activeSeason.id },
          raceItem: { inventoryItem: approvedItem },
          status: { not: "REFUNDED" },
        },
        _sum: { amount: true },
      }),
    ]);
    // Every registration HayLoft would list; a portal registration an admin rejected is out.
    const rows = accounts.filter((a) => a.approvalStatus !== "REJECTED");
    const sum = (pick: (a: (typeof rows)[number]) => number) => rows.reduce((s, a) => s + pick(a), 0);

    const breederCount = rows.filter((a) => a.approvalStatus === "APPROVED").length;
    const reservedBirds = sum((a) => a.reservedBirds);
    const reservedWaiting = sum((a) => (a.isWaiting ? a.reservedBirds : 0));
    const hereCount = sum((a) => a.inLoftBirds);
    const replacedCount = sum((a) => a.replacedBirds);
    const lostBirds = sum((a) => a.lostBirds);
    const totalPerchFee = sum((a) => a.perchFee);

    const entryFeeBirds = sum((a) => a.entryBirds);
    const entryFees = sum((a) => a.entryFee);
    const entryRefundSum = sum((a) => a.entryRefund);
    // Commission is taken on what was kept, after refunds — as HayLoft does
    // (AGN 2025: ($282,100 − $350) × 15% = $42,262.50).
    const entryCommission = (entryFees - entryRefundSum) * (cutPct / 100);
    const entryTotalValue = entryFees - entryRefundSum - entryCommission;

    const hotSpotBirds = sum((a) => a.hotSpotBirds);
    const hotSpotFees = sum((a) => a.hotSpotFee);
    const hotSpotRefunds = sum((a) => a.hotSpotRefund);
    const hotSpotCommission = (hotSpotFees - hotSpotRefunds) * (cutPct / 100);
    const hotSpotValue = hotSpotFees - hotSpotRefunds - hotSpotCommission;

    // --- Birds: counted once each, not once per race flown ---
    const totalBirdsCount = hereCount + replacedCount;
    const injuredBirds = injuredRows.length;
    const foreignBirds = foreignBirdRows;
    const activeBirds = Math.max(0, totalBirdsCount - lostBirds - injuredBirds);

    // --- "Total payment": payments of each type (PAYMENT_CALC) ---
    const paidPerchFee = sum((a) => a.pay.perchFee);
    const paidEntryFee = sum((a) => a.pay.entryFee);
    const paidHotSpot = sum((a) => a.pay.hotSpot);
    const paidClasses = sum((a) => a.pay.bets);
    const paidRegistration = sum((a) => a.pay.registration);
    const totalCollected = sum((a) => a.totalPayment);
    const platformFee = totalCollected * (cutPct / 100);

    // --- "Total bets": class bets (INVENTORY_BETS_CALC, every flag) plus any
    // race pool bets placed through the portal, which are separate money ---
    const classBets = sum((a) => a.betsValue);
    const classBetsRefund = sum((a) => a.betsRefund);
    const poolBets = poolBetsAgg._sum.amount ?? 0;
    const totalBets = classBets + poolBets;
    const betsRefund = classBetsRefund;
    // As with fees, commission is on what was kept (HayLoft: $16,460 × 15% = $2,469).
    const betsCommission = (classBets - classBetsRefund) * (bettingCutPercent / 100) + poolBets * (cutPct / 100);
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
      entryFeeBirds,
      entryFees,
      entryRefund: entryRefundSum,
      entryCommission,
      entryTotalValue,
      hotSpotBirds,
      hotSpotFees,
      hotSpotRefunds,
      hotSpotCommission,
      hotSpotValue,
      totalBets,
      betsRefund,
      betsCommission,
      betsValue,
      // "Total payment": money received, by payment type.
      paidPerchFee,
      paidEntryFee,
      paidHotSpot,
      paidRegistration,
      paymentClasses: paidClasses,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
