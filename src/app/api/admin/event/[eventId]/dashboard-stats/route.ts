import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { approvedItem, activeRaceItemOr, approvedInventory } from "@/lib/entry-filters";
import { prisma } from "@/lib/prisma";
import { BET_FLAG_SELECT, BET_PRICE_SELECT, betsActive, priceItemBets } from "@/lib/class-bets";
import { PAYMENT_TYPE } from "@/lib/payment-types";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * The event Details screen: the same boxes and the same arithmetic as HayLoft's
 * Details screen, so the two can be compared figure by figure. Verified against
 * HayLoft's AGN 2025 screen (all boxes) and its stored procedures
 * EVENT_BET_TOTALS and PAYMENT_CALC. `scripts/hayloft-sync/reconcile-details.ts`
 * re-checks every event.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
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

    // --- EventInventory aggregations ---
    const inventories = await prisma.eventInventory.findMany({
      where: { seasonId: activeSeason.id, ...approvedInventory },
      select: { id: true, reservedBirds: true },
    });

    const inventoryIdList = inventories.map((i) => i.id);
    const breederCount = inventories.length;
    const reservedWaiting = await prisma.eventInventory.count({
      where: { seasonId: activeSeason.id, approvalStatus: "WAITING" },
    });
    const reservedBirds = inventories.reduce((s, i) => s + (i.reservedBirds ?? 0), 0);

    // --- EventInventoryItem aggregations (single pass) ---
    const items = await prisma.eventInventoryItem.findMany({
      where: { eventInventoryId: { in: inventoryIdList }, deletedAt: null },
      select: {
        replacedItemId: true,
        entryFeeValue: true,
        entryRefund: true,
        perchFeeValue: true,
        hotSpotFeeValue: true,
        hotSpotRefund: true,
        raceFeeValue: true,
        betsRefund: true,
        isBetActive: true,
        bird: { select: { isLost: true } },
        ...BET_FLAG_SELECT,
      },
    });

    let totalPerchFee = 0;
    let hereCount = 0;
    let replacedCount = 0;
    let entryFees = 0;
    let entryRefundSum = 0;
    let hotSpotFees = 0;
    let hotSpotRefunds = 0;
    // Counted per entry, as HayLoft's Details screen does.
    let lostEntries = 0;
    let entryFeeBirds = 0;
    let hotSpotBirds = 0;
    let classBets = 0;
    let classBetsRefund = 0;
    const scheme = activeSeason.bettingScheme;

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

      // A bird whose fee was refunded no longer counts as paying one.
      if ((item.entryFeeValue ?? 0) > 0 && !((item.entryRefund ?? 0) > 0)) entryFeeBirds++;
      if ((item.hotSpotFeeValue ?? 0) > 0 && !((item.hotSpotRefund ?? 0) > 0)) hotSpotBirds++;
      if (item.bird?.isLost === 1) lostEntries++;

      // EVENT_BET_TOTALS counts only entries whose bets are active; a refunded
      // or replaced bird's bets sit in BETS_REFUND instead.
      if (betsActive(item)) classBets += priceItemBets(item, scheme);
      classBetsRefund += item.betsRefund ?? 0;
    }

    // Commission is taken on what was kept, after refunds — as HayLoft does
    // (AGN 2025: ($282,100 − $350) × 15% = $42,262.50).
    const entryCommission = (entryFees - entryRefundSum) * (cutPct / 100);
    const entryTotalValue = entryFees - entryRefundSum - entryCommission;
    const hotSpotCommission = (hotSpotFees - hotSpotRefunds) * (cutPct / 100);
    const hotSpotValue = hotSpotFees - hotSpotRefunds - hotSpotCommission;

    // --- RaceItem aggregations ---
    // Only the race entries that matter here, not every entry of every race.
    const [foreignBirdRows, injuredRows] = await Promise.all([
      prisma.raceItem.count({
        where: { race: { seasonId: activeSeason.id }, OR: activeRaceItemOr, status: "FOREIGN_BIRD" },
      }),
      prisma.raceItem.findMany({
        where: {
          race: { seasonId: activeSeason.id },
          OR: activeRaceItemOr,
          inventoryItemId: { not: null },
          displayStatus: { trigger: "INJURED" },
        },
        select: { inventoryItemId: true },
        distinct: ["inventoryItemId"],
      }),
    ]);

    // A bird is counted once, not once per race it flew. Lost follows the
    // bird's own status (HayLoft AGN 2025: 662 lost of 1,397 entries).
    // Injured and foreign come from race entries; a foreign bird has no entry.
    const injuredEntries = new Set(injuredRows.map((r) => r.inventoryItemId as number));
    const totalBirdsCount = items.length;
    const lostBirds = lostEntries;
    const injuredBirds = injuredEntries.size;
    const foreignBirds = foreignBirdRows;
    const activeBirds = Math.max(0, items.length - lostEntries - injuredBirds);

    // --- Payment aggregations ---
    const paidPayments = await prisma.payment.findMany({
      where: { eventInventoryId: { in: inventoryIdList }, status: "PAID" },
      select: { paymentValue: true, paymentType: true, hotspotGate: true },
    });
    let totalCollected = 0;
    let paidPerchFee = 0;
    let paidEntryFee = 0;
    let paidHotSpot = 0;
    let paidClasses = 0;
    let paidRegistration = 0;
    // HayLoft's "Total payment" box: the payments of each type (PAYMENT_CALC).
    for (const p of paidPayments) {
      const v = p.paymentValue ?? 0;
      totalCollected += v;
      if (p.paymentType === PAYMENT_TYPE.HOT_SPOT || p.hotspotGate) paidHotSpot += v;
      else if (p.paymentType === PAYMENT_TYPE.PERCH_FEE) paidPerchFee += v;
      else if (p.paymentType === PAYMENT_TYPE.ENTRY_FEE) paidEntryFee += v;
      else if (p.paymentType === PAYMENT_TYPE.BETS) paidClasses += v;
      // Portal registrations take one payment for all their fees.
      else if (p.paymentType == null || p.paymentType === PAYMENT_TYPE.REGISTRATION) paidRegistration += v;
    }
    const platformFee = totalCollected * (cutPct / 100);

    // --- Bet aggregations ---
    // Class bets (flags on the entry, HayLoft's "Total bets") plus race pool
    // bets placed through the portal. They are separate money, so both count.
    const betCutPct = scheme?.bettingCutPercent ?? cutPct;
    const poolBetsAgg = await prisma.bet.aggregate({
      where: {
        race: { seasonId: activeSeason.id },
        raceItem: { inventoryItem: approvedItem },
        status: { not: "REFUNDED" },
      },
      _sum: { amount: true },
    });
    const poolBets = poolBetsAgg._sum.amount ?? 0;

    const poolPayoutAgg = await prisma.bet.aggregate({
      where: {
        race: { seasonId: activeSeason.id },
        raceItem: { inventoryItem: approvedItem },
        status: { in: ["WON", "PAID"] },
      },
      _sum: { payoutValue: true },
    });
    const poolPayout = poolPayoutAgg._sum.payoutValue ?? 0;

    const totalBets = classBets + poolBets;
    const betsRefund = classBetsRefund + poolPayout;
    // As with fees, commission is on what was kept (HayLoft: $16,460 × 15% = $2,469).
    const betsCommission = (classBets - classBetsRefund) * (betCutPct / 100) + poolBets * (cutPct / 100);
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
