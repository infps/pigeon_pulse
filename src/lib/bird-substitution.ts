/**
 * Backup bird substitution — swapping a reserve bird in for one that is out.
 *
 * Port of the HayLoft procedures that had no counterpart here, even though the
 * schema kept all their columns (isBackup, replacedItemId, maxBackupBirdCount):
 *
 *   BIRD_BACKUP_APPLY            -> applyBackup
 *   EVENT_INVENTORY_ITEM_REPLACE -> replaceItem
 *   EVENT_INVENTORY_ITEM_RESTORE -> restoreItem
 *   PERCH_FEES_RECALC            -> recalcPerchFees
 *   RETURN_BIRD                  -> returnBird
 *
 * The shape of the swap: the backup inherits the outgoing bird's fee identity
 * (its bird number, perch fee, entry fee and hotspot fee) so the registration
 * still bills the same, and the outgoing item is stripped of its fees, flagged
 * with a bets refund, and linked to its replacement.
 *
 * One deliberate departure: HayLoft summed bet stakes from per-item columns and
 * its total omitted WTA tier 5 — a bug. Stakes now come from the Bet model and
 * every tier counts.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export interface SubstitutionResult {
  outgoingItemId: number;
  incomingItemId: number;
  outgoingBand: string;
  incomingBand: string;
  birdNo: number | null;
  betsRefund: number | null;
}

function bandOf(bird: {
  band1?: string | null;
  band2?: string | null;
  band3?: string | null;
  band4?: string | null;
  band?: string | null;
} | null): string {
  if (!bird) return "";
  const parts = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean);
  return parts.length > 0 ? parts.join("-") : (bird.band ?? "");
}

/**
 * Total stake riding on an inventory item, across every race it is entered in.
 * Returned as the amount to refund when the bird is pulled from the race.
 */
export async function betsStakeFor(tx: Tx, inventoryItemId: number): Promise<number> {
  const result = await tx.bet.aggregate({
    where: {
      raceItem: { inventoryItemId },
      status: { in: ["PLACED", "PAID", "WON"] },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

/**
 * Port of PERCH_FEES_RECALC.
 *
 * Closes gaps in the bird numbering, then reprices every non-backup bird from
 * the season's graduated perch fee table. Run after anything that changes which
 * birds are in the lineup.
 */
export async function recalcPerchFees(tx: Tx, eventInventoryId: number): Promise<void> {
  const inventory = await tx.eventInventory.findUnique({
    where: { id: eventInventoryId },
    select: { season: { select: { feeSchemeId: true } } },
  });
  await repriceInventories(tx, { eventInventoryId }, inventory?.season?.feeSchemeId ?? null);
}

/**
 * Renumber and reprice every registration in a season at once.
 *
 * Used after bulk work such as a season clone, where doing it one registration
 * at a time would mean thousands of round trips and blow the transaction budget.
 */
export async function recalcPerchFeesForSeason(tx: Tx, seasonId: number): Promise<void> {
  const season = await tx.season.findUnique({
    where: { id: seasonId },
    select: { feeSchemeId: true },
  });
  await repriceInventories(tx, { seasonId }, season?.feeSchemeId ?? null);
}

/**
 * The two statements behind both entry points, scoped either to one
 * registration or to a whole season. Set-based on purpose: the legacy procedure
 * looped row by row, which is free inside the database but not from here.
 */
async function repriceInventories(
  tx: Tx,
  scope: { eventInventoryId: number } | { seasonId: number },
  feeSchemeId: number | null
): Promise<void> {
  const oneInventory = "eventInventoryId" in scope;
  const inventoryId = oneInventory ? scope.eventInventoryId : 0;
  const seasonId = oneInventory ? 0 : scope.seasonId;

  // 1. Close gaps in the numbering, per registration, preserving order.
  await tx.$executeRaw`
    WITH ordered AS (
      SELECT eii."ID_EVENT_INVENTORY_ITEM" AS id,
             ROW_NUMBER() OVER (
               PARTITION BY eii."ID_EVENT_INVENTORY"
               ORDER BY eii."BIRD_NO" ASC, eii."ID_EVENT_INVENTORY_ITEM" ASC
             ) AS rn
      FROM "EventInventoryItem" eii
      JOIN "EventInventory" ei ON ei."ID_EVENT_INVENTORY" = eii."ID_EVENT_INVENTORY"
      WHERE eii."BIRD_NO" IS NOT NULL
        AND (${oneInventory}::boolean = false OR eii."ID_EVENT_INVENTORY" = ${inventoryId})
        AND (${oneInventory}::boolean = true  OR ei."SEASON_ID" = ${seasonId})
    )
    UPDATE "EventInventoryItem" t
    SET "BIRD_NO" = ordered.rn
    FROM ordered
    WHERE t."ID_EVENT_INVENTORY_ITEM" = ordered.id
      AND t."BIRD_NO" IS DISTINCT FROM ordered.rn`;

  if (feeSchemeId == null) return;

  // 2. Reprice non-backup birds from the graduated table. A bird number with no
  //    matching band gets NULL rather than zero.
  await tx.$executeRaw`
    UPDATE "EventInventoryItem" t
    SET "PERCH_FEE_VALUE" = (
      SELECT bfi."PERCH_FEE"
      FROM "BirdFeeItems" bfi
      WHERE bfi."ID_FEE_SCHEME" = ${feeSchemeId}
        AND bfi."BIRD_NO" = t."BIRD_NO"
      LIMIT 1
    )
    FROM "EventInventory" ei
    WHERE ei."ID_EVENT_INVENTORY" = t."ID_EVENT_INVENTORY"
      AND t."BIRD_NO" IS NOT NULL
      AND COALESCE(t."IS_BACKUP", 0) <> 1
      AND (${oneInventory}::boolean = false OR t."ID_EVENT_INVENTORY" = ${inventoryId})
      AND (${oneInventory}::boolean = true  OR ei."SEASON_ID" = ${seasonId})`;
}

/**
 * Port of EVENT_INVENTORY_ITEM_REPLACE.
 *
 * Strips the outgoing item of everything chargeable, records what its bets are
 * owed back, points it at its replacement, and deactivates the bird.
 */
export async function replaceItem(
  tx: Tx,
  outgoingItemId: number,
  incomingItemId: number
): Promise<number | null> {
  const stake = await betsStakeFor(tx, outgoingItemId);
  const betsRefund = stake === 0 ? null : stake;

  const outgoing = await tx.eventInventoryItem.update({
    where: { id: outgoingItemId },
    data: {
      birdNo: null,
      perchFeeValue: null,
      entryFeeValue: null,
      entryRefund: null,
      entryFeePaid: 0,
      hotSpotFeeValue: null,
      hotSpotRefund: null,
      betsRefund,
      isBetActive: 0,
      replacedItemId: incomingItemId,
    },
    select: { birdId: true },
  });

  if (outgoing.birdId != null) {
    await tx.bird.update({ where: { id: outgoing.birdId }, data: { isActive: 0 } });
  }

  return betsRefund;
}

/**
 * Port of BIRD_BACKUP_APPLY.
 *
 * Finds the first eligible reserve in the same registration and swaps it in for
 * the outgoing bird. Eligibility matches legacy: flagged as a backup, not lost,
 * and not already carrying a perch fee.
 */
export async function applyBackup(
  outgoingItemId: number,
  options: { incomingItemId?: number } = {}
): Promise<SubstitutionResult> {
  return prisma.$transaction(
    async (tx) => applyBackupTx(tx, outgoingItemId, options),
    { maxWait: 20000, timeout: 120000 }
  );
}

/** The substitution itself, so callers can compose it into a larger transaction. */
export async function applyBackupTx(
  tx: Tx,
  outgoingItemId: number,
  options: { incomingItemId?: number } = {}
): Promise<SubstitutionResult> {
  const outgoing = await tx.eventInventoryItem.findUnique({
    where: { id: outgoingItemId },
    select: {
      id: true,
      eventInventoryId: true,
      birdNo: true,
      perchFeeValue: true,
      entryFeeValue: true,
      entryFeePaid: true,
      hotSpotFeeValue: true,
      replacedItemId: true,
      bird: { select: { band1: true, band2: true, band3: true, band4: true, band: true } },
    },
  });

  if (!outgoing) throw new Error("That registration entry no longer exists.");
  if (outgoing.replacedItemId != null) {
    throw new Error("This bird has already been replaced.");
  }
  if (outgoing.eventInventoryId == null) {
    throw new Error("That entry is not attached to a registration.");
  }

  // Either the caller picked a specific reserve, or take the first eligible.
  const incoming = options.incomingItemId
    ? await tx.eventInventoryItem.findFirst({
        where: {
          id: options.incomingItemId,
          eventInventoryId: outgoing.eventInventoryId,
          isBackup: 1,
        },
        select: {
          id: true,
          bird: { select: { id: true, isLost: true, band1: true, band2: true, band3: true, band4: true, band: true } },
        },
      })
    : await tx.eventInventoryItem.findFirst({
        where: {
          eventInventoryId: outgoing.eventInventoryId,
          isBackup: 1,
          bird: { NOT: { isLost: 1 } },
          OR: [{ perchFeeValue: null }, { perchFeeValue: 0 }],
        },
        orderBy: { birdNo: "asc" },
        select: {
          id: true,
          bird: { select: { id: true, isLost: true, band1: true, band2: true, band3: true, band4: true, band: true } },
        },
      });

  if (!incoming) {
    throw new Error("No eligible backup bird is available on this registration.");
  }
  if (incoming.bird?.isLost === 1) {
    throw new Error("That backup bird is marked lost and cannot be flown.");
  }

  // The reserve takes over the outgoing bird's chargeable identity.
  await tx.eventInventoryItem.update({
    where: { id: incoming.id },
    data: {
      birdNo: outgoing.birdNo,
      perchFeeValue: outgoing.perchFeeValue,
      entryFeeValue: outgoing.entryFeeValue,
      entryFeePaid: outgoing.entryFeePaid,
      hotSpotFeeValue: outgoing.hotSpotFeeValue,
      isBackup: 0,
    },
  });

  if (incoming.bird?.id != null) {
    await tx.bird.update({ where: { id: incoming.bird.id }, data: { isActive: 1 } });
  }

  const betsRefund = await replaceItem(tx, outgoing.id, incoming.id);

  // Race entries follow the bird: the reserve inherits the outgoing bird's
  // place in every race that has not already been flown.
  await tx.raceItem.updateMany({
    where: {
      inventoryItemId: outgoing.id,
      race: { status: "REGISTERING" },
    },
    data: { inventoryItemId: incoming.id },
  });

  await tx.birdEventHistory.createMany({
    data: [
      {
        eventInventoryItemId: outgoing.id,
        action: "STATUS_CHANGED" as const,
        detail: `Replaced by backup ${bandOf(incoming.bird)}`,
      },
      {
        eventInventoryItemId: incoming.id,
        action: "STATUS_CHANGED" as const,
        detail: `Substituted in for ${bandOf(outgoing.bird)} as bird ${outgoing.birdNo ?? "?"}`,
      },
    ],
  });

  return {
    outgoingItemId: outgoing.id,
    incomingItemId: incoming.id,
    outgoingBand: bandOf(outgoing.bird),
    incomingBand: bandOf(incoming.bird),
    birdNo: outgoing.birdNo,
    betsRefund,
  };
}

/**
 * Port of EVENT_INVENTORY_ITEM_RESTORE.
 *
 * Undoes a substitution for the bird that was pulled: it re-enters the lineup
 * at the end of the numbering, the registration is repriced, and the bird is
 * reactivated.
 */
export async function restoreItem(itemId: number): Promise<{ itemId: number; birdNo: number | null }> {
  return prisma.$transaction(
    async (tx) => {
      const item = await tx.eventInventoryItem.findUnique({
        where: { id: itemId },
        select: { id: true, eventInventoryId: true, birdId: true, replacedItemId: true },
      });

      if (!item) throw new Error("That registration entry no longer exists.");
      if (item.replacedItemId == null) {
        throw new Error("That bird was not replaced, so there is nothing to restore.");
      }
      if (item.eventInventoryId == null) {
        throw new Error("That entry is not attached to a registration.");
      }

      const highest = await tx.eventInventoryItem.aggregate({
        where: { eventInventoryId: item.eventInventoryId },
        _max: { birdNo: true },
      });
      const birdNo = (highest._max.birdNo ?? 0) + 1;

      await tx.eventInventoryItem.update({
        where: { id: item.id },
        data: { birdNo, replacedItemId: null },
      });

      await recalcPerchFees(tx, item.eventInventoryId);

      if (item.birdId != null) {
        await tx.bird.update({ where: { id: item.birdId }, data: { isActive: 1 } });
      }

      await tx.birdEventHistory.create({
        data: {
          eventInventoryItemId: item.id,
          action: "STATUS_CHANGED",
          detail: "Restored to the lineup after replacement",
        },
      });

      const restored = await tx.eventInventoryItem.findUnique({
        where: { id: item.id },
        select: { birdNo: true },
      });

      return { itemId: item.id, birdNo: restored?.birdNo ?? birdNo };
    },
    { maxWait: 20000, timeout: 120000 }
  );
}

/**
 * Port of RETURN_BIRD — the bird goes home.
 *
 * Stamps the departure date and releases the RFID tag so it can be reused.
 */
export async function returnBird(
  inventoryItemId: number,
  returnDate: Date = new Date()
): Promise<{ inventoryItemId: number; birdId: number | null }> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.eventInventoryItem.update({
      where: { id: inventoryItemId },
      data: { departureDate: returnDate },
      select: { id: true, birdId: true },
    });

    if (item.birdId != null) {
      await tx.bird.update({ where: { id: item.birdId }, data: { rfid: null } });
    }

    await tx.birdEventHistory.create({
      data: {
        eventInventoryItemId: item.id,
        action: "STATUS_CHANGED",
        detail: `Returned to breeder on ${returnDate.toLocaleDateString("en-US")}; RFID released`,
      },
    });

    return { inventoryItemId: item.id, birdId: item.birdId };
  });
}
