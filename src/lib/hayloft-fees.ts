/**
 * Fees and refunds, as HayLoft applies them. Ports of its stored procedures:
 *
 *   ENTRY_FEE_BATCH_SET   postSeasonFees    — put the scheme's entry fee (or
 *                                             Hot Spot 1 fee) on every bird
 *                                             that is still competing
 *   BIRD_REFUNDS_MODIFY   applyLostRefunds  — when a bird is marked lost (or
 *                                             found), set or clear its entry,
 *                                             hot spot and bets refunds
 *   BIRD_BETS_REFUND_SET  refundBirdBets    — move a bird's class bets into
 *                                             BETS_REFUND and switch them off
 *
 * HayLoft's own conditions are kept, including its quirk that the hot spot
 * refund applies whenever no race is given (its Hot Spot 1 check then finds no
 * event and passes).
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { itemBetsValue, RACE_TYPE } from "@/lib/hayloft-account";

type Tx = Prisma.TransactionClient;

/**
 * ENTRY_FEE_BATCH_SET: 'post_entry' sets FEE_SCHEME.ENTRY_FEE, 'post_hot_spot'
 * sets FEE_SCHEME.HOT_SPOT1_FEE, on every entry of the season whose bird is not
 * lost, is active, has not been replaced and has not departed. Other entries
 * are left as they are. Returns how many entries were set.
 */
export async function postSeasonFees(
  seasonId: number,
  operation: "post_entry" | "post_hot_spot"
): Promise<{ updated: number; amount: number | null; error: string | null }> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { feeScheme: { select: { entryFee: true, hotSpot1Fee: true } } },
  });
  const amount = operation === "post_entry" ? season?.feeScheme?.entryFee ?? null : season?.feeScheme?.hotSpot1Fee ?? null;
  if (amount == null) {
    return {
      updated: 0,
      amount: null,
      error: operation === "post_entry"
        ? "This season's fee scheme has no entry fee."
        : "This season's fee scheme has no Hot Spot 1 fee.",
    };
  }
  const res = await prisma.eventInventoryItem.updateMany({
    where: {
      eventInventory: { seasonId },
      deletedAt: null,
      replacedItemId: null,
      departureDate: null,
      bird: { isLost: 0, isActive: 1 },
    },
    data: operation === "post_entry" ? { entryFeeValue: amount } : { hotSpotFeeValue: amount },
  });
  return { updated: res.count, amount, error: null };
}

/** BIRD_BETS_REFUND_SET: active bets with a value move into BETS_REFUND and are switched off. */
export async function refundBirdBets(tx: Tx, inventoryItemId: number): Promise<void> {
  const item = await tx.eventInventoryItem.findUnique({
    where: { id: inventoryItemId },
    include: { eventInventory: { select: { season: { select: { bettingScheme: true } } } } },
  });
  if (!item) return;
  const bets = itemBetsValue(item, item.eventInventory?.season?.bettingScheme ?? null);
  // IS_BET_ACTIVE <> 0 (a portal entry that never set it is active).
  const active = item.isBetActive == null || item.isBetActive !== 0;
  if (active && bets > 0) {
    await tx.eventInventoryItem.update({
      where: { id: inventoryItemId },
      data: { betsRefund: bets, isBetActive: 0 },
    });
  }
}

/**
 * BIRD_REFUNDS_MODIFY, run after a bird's lost status changes (HayLoft calls it
 * from BIRD_LOST_STATUS_MODIFY). `raceId` is the race the bird was lost in, or
 * null when the status was changed by hand.
 */
export async function applyLostRefunds(
  tx: Tx,
  args: { birdId: number; raceId: number | null; isLost: boolean }
): Promise<void> {
  const { birdId, raceId, isLost } = args;
  let raceSeasonId: number | null = null;
  if (raceId != null) {
    const race = await tx.race.findUnique({ where: { id: raceId }, select: { raceTypeId: true, seasonId: true } });
    // No refunds at all for a bird lost in the final race.
    if (race?.raceTypeId === RACE_TYPE.FINAL) return;
    raceSeasonId = race?.seasonId ?? null;
  }

  // The bird's entry in an open event (HayLoft: e.IS_OPEN = 1).
  const entries = await tx.eventInventoryItem.findMany({
    where: { birdId, deletedAt: null, eventInventory: { season: { event: { isOpen: 1 } } } },
    select: {
      id: true,
      entryFeeValue: true,
      entryFeePaid: true,
      hotSpotFeeValue: true,
      eventInventory: { select: { seasonId: true, season: { select: { feeScheme: { select: { isRefundable: true } } } } } },
    },
    orderBy: { id: "desc" },
  });

  // Entry fee refund: only when the scheme is refundable and a fee was charged.
  const entry = entries.find(
    (e) => e.eventInventory?.season?.feeScheme?.isRefundable === 1 && (e.entryFeeValue ?? 0) > 0
  );
  if (entry) {
    const refund = !isLost || entry.entryFeePaid === 0 ? null : entry.entryFeeValue;
    await tx.eventInventoryItem.update({ where: { id: entry.id }, data: { entryRefund: refund } });
  }

  // Hot spot refund: only before Hot Spot 1 has been raced. With no race given,
  // HayLoft's check looks up no event and always passes; kept as is.
  const hs1Flown =
    raceSeasonId != null &&
    (await tx.race.count({ where: { seasonId: raceSeasonId, raceTypeId: RACE_TYPE.HOT_SPOT_1 } })) > 0;
  if (!hs1Flown) {
    const hs = entries.find((e) => (e.hotSpotFeeValue ?? 0) > 0);
    if (hs) {
      await tx.eventInventoryItem.update({
        where: { id: hs.id },
        data: { hotSpotRefund: isLost ? hs.hotSpotFeeValue : null },
      });
    }
  }

  // A bird lost after it was bet on: its bets are refunded and switched off.
  if (isLost && entries[0]) await refundBirdBets(tx, entries[0].id);
}
