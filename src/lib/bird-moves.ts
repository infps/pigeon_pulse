/**
 * Moving a bird's entry: to another perch, basket, loft group or owner.
 * Where HayLoft has a procedure for it, this follows it:
 *
 *   PERCH_FEES_RECALC            renumber a registration's perches 1..n (by
 *                                current number) and price each non-backup
 *                                perch from the fee scheme's per-bird fees
 *   EVENT_INVENTORY_ITEM_CHANGE  move one bird to another registration: refused
 *                                while it carries refunds; its entry fee, hot
 *                                spot fee and class bets are cleared, and both
 *                                registrations' perch fees are recalculated
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export class MoveError extends Error {}

/**
 * The perch a newly registered bird takes: the next number in its
 * registration, as HayLoft numbers every bird it registers (BIRD_NO).
 */
export async function nextPerch(tx: Tx | typeof prisma, eventInventoryId: number): Promise<number> {
  const last = await tx.eventInventoryItem.aggregate({
    where: { eventInventoryId, deletedAt: null },
    _max: { birdNo: true },
  });
  return (last._max.birdNo ?? 0) + 1;
}

/** PERCH_FEES_RECALC for one registration. */
export async function perchFeesRecalc(tx: Tx, eventInventoryId: number): Promise<void> {
  const reg = await tx.eventInventory.findUnique({
    where: { id: eventInventoryId },
    select: { season: { select: { feeScheme: { select: { birdFeeItems: { select: { birdNo: true, birdFee: true } } } } } } },
  });
  const feeByNo = new Map((reg?.season?.feeScheme?.birdFeeItems ?? []).map((f) => [f.birdNo, f.birdFee]));
  const numbered = await tx.eventInventoryItem.findMany({
    where: { eventInventoryId, birdNo: { not: null }, deletedAt: null },
    orderBy: [{ birdNo: "asc" }, { id: "asc" }],
    select: { id: true, isBackup: true, birdNo: true, perchFeeValue: true },
  });
  for (const { item, birdNo, perchFeeValue } of perchPlan(numbered, feeByNo)) {
    // Only rows that change are written.
    if (item.birdNo === birdNo && (perchFeeValue === undefined || (item.perchFeeValue ?? null) === perchFeeValue)) continue;
    await tx.eventInventoryItem.update({
      where: { id: item.id },
      data: perchFeeValue === undefined ? { birdNo } : { birdNo, perchFeeValue },
    });
  }
}

/**
 * PERCH_FEES_RECALC's result for numbered entries already in perch order:
 * numbers 1..n, and the per-bird fee for each non-backup perch (a backup keeps
 * its number and its fee: `perchFeeValue` undefined means unchanged).
 */
export function perchPlan<T extends { isBackup: number | null }>(
  numberedInOrder: T[],
  feeByNo: Map<number | null, number | null>
): Array<{ item: T; birdNo: number; perchFeeValue: number | null | undefined }> {
  return numberedInOrder.map((item, i) => ({
    item,
    birdNo: i + 1,
    // HayLoft prices only IS_BACKUP = 0 (it never leaves the flag empty; an
    // unset portal entry is not a backup).
    perchFeeValue: item.isBackup !== 1 ? feeByNo.get(i + 1) ?? null : undefined,
  }));
}

async function audit(tx: Tx, itemId: number, detail: string, userId: string | null, extra: { groupId?: number; basketId?: number; action?: "GROUP_MOVED" | "BASKET_ASSIGNED" | "STATUS_CHANGED" } = {}) {
  await tx.birdEventHistory.create({
    data: {
      eventInventoryItemId: itemId,
      action: extra.action ?? "STATUS_CHANGED",
      detail,
      groupId: extra.groupId,
      basketId: extra.basketId,
      performedById: userId,
    },
  });
}

async function liveItem(tx: Tx, itemId: number) {
  const item = await tx.eventInventoryItem.findUnique({
    where: { id: itemId },
    select: {
      id: true, birdId: true, birdNo: true, deletedAt: true, eventInventoryId: true,
      entryRefund: true, betsRefund: true, hotSpotRefund: true,
      eventInventory: { select: { seasonId: true, breeder: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!item || item.eventInventoryId == null) throw new MoveError("Bird entry not found");
  if (item.deletedAt) throw new MoveError("This bird has been removed from the event.");
  return item;
}

/** Move the bird to perch `perch` of its registration; the others shift, then all are repriced. */
export async function moveToPerch(itemId: number, perch: number, userId: string | null) {
  return prisma.$transaction(async (tx) => {
    const item = await liveItem(tx, itemId);
    const numbered = await tx.eventInventoryItem.findMany({
      where: { eventInventoryId: item.eventInventoryId!, birdNo: { not: null }, deletedAt: null },
      orderBy: [{ birdNo: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const order = numbered.map((n) => n.id).filter((id) => id !== itemId);
    const target = Math.max(1, Math.min(perch, order.length + 1));
    order.splice(target - 1, 0, itemId);
    // Write the new order, then let PERCH_FEES_RECALC number and price it.
    for (let i = 0; i < order.length; i++) {
      await tx.eventInventoryItem.update({ where: { id: order[i] }, data: { birdNo: i + 1 } });
    }
    await perchFeesRecalc(tx, item.eventInventoryId!);
    await audit(tx, itemId, `Moved from perch ${item.birdNo ?? "none"} to perch ${target}`, userId);
    return { perch: target };
  });
}

/** Move the bird into another loft group (the Groups tab's LOFT groups). */
export async function moveToGroup(itemId: number, groupId: number, userId: string | null) {
  return prisma.$transaction(async (tx) => {
    const item = await liveItem(tx, itemId);
    const current = await tx.eventInventoryItem.findUnique({ where: { id: itemId }, select: { currentGroup: { select: { name: true } } } });
    const group = await tx.eventGroup.findFirst({ where: { id: groupId, seasonId: item.eventInventory?.seasonId ?? -1 } });
    if (!group) throw new MoveError("Group not found in this season");
    if (group.hasCapacity && group.capacity != null) {
      const used = await tx.eventInventoryItem.count({ where: { currentGroupId: groupId, deletedAt: null, id: { not: itemId } } });
      if (used >= group.capacity) throw new MoveError(`"${group.name}" is full (${group.capacity})`);
    }
    if (current?.currentGroup) {
      await tx.birdGroupHistory.create({ data: { inventoryItemId: itemId, fromGroupName: current.currentGroup.name } });
    }
    await tx.eventInventoryItem.update({ where: { id: itemId }, data: { currentGroupId: groupId } });
    await audit(tx, itemId, `Moved from group "${current?.currentGroup?.name ?? "none"}" to "${group.name}"`, userId, { action: "GROUP_MOVED", groupId });
    return { group: group.name };
  });
}

/** Put the bird in a basket, replacing its basket for the same phase and race. */
export async function moveToBasket(itemId: number, basketId: number, userId: string | null) {
  return prisma.$transaction(async (tx) => {
    const item = await liveItem(tx, itemId);
    const basket = await tx.eventBasket.findFirst({
      where: { id: basketId, seasonId: item.eventInventory?.seasonId ?? -1 },
      select: { id: true, basketNo: true, label: true, phase: true, raceId: true, capacity: true, _count: { select: { assignments: true } } },
    });
    if (!basket) throw new MoveError("Basket not found in this season");
    const already = await tx.basketAssignment.findFirst({ where: { eventInventoryItemId: itemId, eventBasketId: basketId } });
    if (already) return { basket: basket.label ?? `Basket ${basket.basketNo}` };
    if (basket._count.assignments >= basket.capacity) throw new MoveError(`${basket.label ?? `Basket ${basket.basketNo}`} is full (${basket.capacity})`);
    const previous = await tx.basketAssignment.findMany({
      where: { eventInventoryItemId: itemId, eventBasket: { phase: basket.phase, raceId: basket.raceId } },
      select: { id: true, eventBasket: { select: { label: true, basketNo: true } } },
    });
    if (previous.length) await tx.basketAssignment.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } });
    await tx.basketAssignment.create({ data: { eventInventoryItemId: itemId, eventBasketId: basketId } });
    const from = previous.map((p) => p.eventBasket.label ?? `Basket ${p.eventBasket.basketNo}`).join(", ") || "none";
    const to = basket.label ?? `Basket ${basket.basketNo}`;
    await audit(tx, itemId, `Moved from basket ${from} to ${to}`, userId, { action: "BASKET_ASSIGNED", basketId });
    return { basket: to };
  });
}

/** EVENT_INVENTORY_ITEM_CHANGE: move this one bird to another breeder's registration. */
export async function moveToOwner(itemId: number, targetEventInventoryId: number, userId: string | null) {
  return prisma.$transaction(async (tx) => {
    const item = await liveItem(tx, itemId);
    if (targetEventInventoryId === item.eventInventoryId) throw new MoveError("The bird is already in that registration.");
    const target = await tx.eventInventory.findFirst({
      where: { id: targetEventInventoryId, seasonId: item.eventInventory?.seasonId ?? -1 },
      select: { id: true, breederId: true, breeder: { select: { firstName: true, lastName: true } } },
    });
    if (!target) throw new MoveError("That registration is not in this season.");
    if ((item.entryRefund ?? 0) > 0 || (item.betsRefund ?? 0) > 0 || (item.hotSpotRefund ?? 0) > 0) {
      throw new MoveError("This bird has refunds. Remove the refunds first, as in HayLoft.");
    }
    // Last perch of the new registration; PERCH_FEES_RECALC renumbers both.
    const last = await tx.eventInventoryItem.aggregate({
      where: { eventInventoryId: target.id, deletedAt: null },
      _max: { birdNo: true },
    });
    await tx.eventInventoryItem.update({
      where: { id: itemId },
      data: {
        eventInventoryId: target.id,
        birdNo: (last._max.birdNo ?? 0) + 1,
        entryFeeValue: null, entryFeePaid: 0, entryRefund: null, replacedItemId: null,
        isBetActive: 1, betsRefund: null,
        belgianShowBet1: null, belgianShowBet2: null, belgianShowBet3: null, belgianShowBet4: null,
        belgianShowBet5: null, belgianShowBet6: null, belgianShowBet7: null,
        standardShowBet1: null, standardShowBet2: null, standardShowBet3: null,
        standardShowBet4: null, standardShowBet5: null, standardShowBet6: null,
        wtaBet1: null, wtaBet2: null, wtaBet3: null, wtaBet4: null, wtaBet5: null,
        hotSpotFeeValue: null, hotSpotRefund: null,
      },
    });
    await perchFeesRecalc(tx, item.eventInventoryId!);
    await perchFeesRecalc(tx, target.id);
    // The bird is the new breeder's now.
    if (item.birdId != null && target.breederId != null) {
      await tx.bird.update({ where: { id: item.birdId }, data: { breederId: target.breederId } });
    }
    const fromName = [item.eventInventory?.breeder?.firstName, item.eventInventory?.breeder?.lastName].filter(Boolean).join(" ");
    const toName = [target.breeder?.firstName, target.breeder?.lastName].filter(Boolean).join(" ");
    if (fromName) await tx.birdBreederHistory.create({ data: { inventoryItemId: itemId, fromBreederName: fromName } });
    await audit(tx, itemId, `Moved from ${fromName || "previous owner"} to ${toName || "new owner"} (entry fee, hot spot fee and class bets cleared, perch fees recalculated)`, userId);
    return { owner: toName };
  });
}
