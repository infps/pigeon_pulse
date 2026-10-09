/**
 * Exercises soft delete + restore of an event entry against a real registration.
 *
 * Everything runs inside a transaction that is rolled back at the end, so no
 * data is modified.
 *
 *   bun scripts/verify-entry-delete.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { deleteEntryTx, restoreEntryTx } from "../src/lib/bird-substitution";

class Rollback extends Error {}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function snapshot(tx: Tx, eventInventoryId: number) {
  const items = await tx.eventInventoryItem.findMany({
    where: { eventInventoryId, deletedAt: null },
    orderBy: { id: "asc" },
    select: { id: true, birdNo: true, entryFeeValue: true, perchFeeValue: true },
  });
  const order = await tx.payment.findFirst({
    where: { eventInventoryId, status: "PENDING", paymentDesc: { startsWith: "Registration:" } },
    select: { paymentValue: true },
  });
  const sum = (f: (i: (typeof items)[number]) => number | null) => items.reduce((s, i) => s + (f(i) ?? 0), 0);
  return {
    birds: items.length,
    entry: sum((i) => i.entryFeeValue),
    perch: sum((i) => i.perchFeeValue),
    pendingOrder: order?.paymentValue ?? null,
    rows: JSON.stringify(items),
  };
}

const failures: string[] = [];
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

async function roundTrip(label: string, itemId: number, inventoryId: number, soleCarrier: boolean) {
  console.log(`\n== ${label} (entry ${itemId}, registration ${inventoryId})`);
  try {
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.eventInventoryItem.findUniqueOrThrow({
          where: { id: itemId },
          select: { entryFeeValue: true, perchFeeValue: true },
        });
        const before = await snapshot(tx, inventoryId);
        console.log("before  ", JSON.stringify({ ...before, rows: undefined }));

        await deleteEntryTx(tx, itemId, null);
        const deleted = await snapshot(tx, inventoryId);
        console.log("deleted ", JSON.stringify({ ...deleted, rows: undefined }));
        check("one bird fewer", deleted.birds === before.birds - 1);
        check("perch fees drop by the deleted bird's own", deleted.perch === before.perch - (target.perchFeeValue ?? 0));
        check(
          soleCarrier ? "entry fee still charged once (moved to another bird)" : "entry fees drop by the deleted bird's own",
          deleted.entry === (soleCarrier ? before.entry : before.entry - (target.entryFeeValue ?? 0))
        );
        if (before.pendingOrder != null) {
          const drop = before.entry + before.perch - (deleted.entry + deleted.perch);
          check("unpaid order follows the fees down", Math.abs(before.pendingOrder - (deleted.pendingOrder ?? 0) - Math.min(drop, before.pendingOrder)) < 0.005);
        }
        check("deleting twice is a no-op", (await deleteEntryTx(tx, itemId, null)).alreadyDeleted === true);

        await restoreEntryTx(tx, itemId, null);
        const restored = await snapshot(tx, inventoryId);
        console.log("restored", JSON.stringify({ ...restored, rows: undefined }));
        check("bird count back", restored.birds === before.birds);
        check("fee totals back", restored.entry === before.entry && restored.perch === before.perch);
        check("unpaid order back", restored.pendingOrder === before.pendingOrder);
        if (!soleCarrier) check("every row exactly as before", restored.rows === before.rows);

        throw new Rollback();
      },
      { timeout: 60000 }
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

async function main() {
  // Imported shape: every bird carries its own fee.
  const perBird = await prisma.eventInventoryItem.findFirst({
    where: {
      deletedAt: null,
      entryFeeValue: { gt: 0 },
      eventInventory: { items: { some: { deletedAt: null, entryFeeValue: { gt: 0 }, birdNo: { gt: 1 } } } },
      birdNo: 1,
    },
    orderBy: { id: "desc" },
    select: { id: true, eventInventoryId: true },
  });
  if (perBird?.eventInventoryId) await roundTrip("fee on every bird", perBird.id, perBird.eventInventoryId, false);
  else console.log("No registration with a fee on every bird found; skipped.");

  // App shape: one bird carries the registration's entry fee.
  const sole = await prisma.eventInventoryItem.findFirst({
    where: {
      deletedAt: null,
      entryFeeValue: { gt: 0 },
      eventInventory: {
        AND: [
          { items: { some: { deletedAt: null, OR: [{ entryFeeValue: 0 }, { entryFeeValue: null }] } } },
          { items: { none: { deletedAt: null, entryFeeValue: { gt: 0 }, birdNo: { gt: 1 } } } },
        ],
      },
    },
    orderBy: { id: "desc" },
    select: { id: true, eventInventoryId: true },
  });
  if (sole?.eventInventoryId) await roundTrip("one bird carries the entry fee", sole.id, sole.eventInventoryId, true);
  else console.log("No registration with a single fee-carrying bird found; skipped.");

  console.log(failures.length === 0 ? "\nAll checks passed (rolled back)." : `\n${failures.length} check(s) failed (rolled back).`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});