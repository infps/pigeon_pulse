/**
 * Exercises the backup substitution against real registrations.
 *
 * Everything runs inside a transaction that is rolled back at the end, so the
 * live data is never modified — the script proves the swap does what HayLoft's
 * BIRD_BACKUP_APPLY did without touching production rows.
 *
 *   bun scripts/verify-substitution.ts
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { applyBackupTx } from "../src/lib/bird-substitution";

class Rollback extends Error {}

const band = (b: { band1?: string | null; band2?: string | null; band3?: string | null; band4?: string | null } | null) =>
  b ? [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") : "—";

async function main() {
  // A registration holding both a live bird and an unused reserve.
  const candidates = await prisma.eventInventory.findMany({
    where: {
      items: { some: { isBackup: 1 } },
      AND: [{ items: { some: { NOT: { isBackup: 1 }, birdNo: { not: null } } } }],
    },
    select: {
      id: true,
      loft: true,
      breeder: { select: { firstName: true, lastName: true } },
      items: {
        select: {
          id: true, birdNo: true, isBackup: true, perchFeeValue: true,
          entryFeeValue: true, entryFeePaid: true, hotSpotFeeValue: true,
          replacedItemId: true,
          bird: { select: { band1: true, band2: true, band3: true, band4: true, isLost: true, isActive: true } },
        },
        orderBy: { birdNo: "asc" },
      },
    },
    take: 3,
  });

  if (candidates.length === 0) {
    console.log("No registration in the data has both an active bird and a backup — nothing to exercise.");
    await prisma.$disconnect();
    process.exit(0);
  }

  for (const inv of candidates) {
    const outgoing = inv.items.find(
      (i) => i.isBackup !== 1 && i.birdNo != null && i.replacedItemId == null
    );
    const reserve = inv.items.find((i) => i.isBackup === 1 && i.bird?.isLost !== 1);
    if (!outgoing || !reserve) continue;

    const who = `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim();
    console.log(`Registration ${inv.id} — ${who || "unknown breeder"} (${inv.loft ?? "no loft"})`);
    console.log(
      `  out: ${band(outgoing.bird)} bird#${outgoing.birdNo} perch=${outgoing.perchFeeValue ?? "—"}` +
        ` entry=${outgoing.entryFeeValue ?? "—"} paid=${outgoing.entryFeePaid ?? "—"} hs=${outgoing.hotSpotFeeValue ?? "—"}`
    );
    console.log(`  in : ${band(reserve.bird)} (backup, perch=${reserve.perchFeeValue ?? "—"})`);

    try {
      await prisma.$transaction(async (tx) => {
        const result = await applyBackupTx(tx, outgoing.id);

        const after = await tx.eventInventoryItem.findMany({
          where: { id: { in: [outgoing.id, result.incomingItemId] } },
          select: {
            id: true, birdNo: true, isBackup: true, perchFeeValue: true,
            entryFeeValue: true, entryFeePaid: true, hotSpotFeeValue: true,
            betsRefund: true, isBetActive: true, replacedItemId: true,
            bird: { select: { isActive: true, band1: true, band2: true, band3: true, band4: true } },
          },
        });

        const outAfter = after.find((a) => a.id === outgoing.id)!;
        const inAfter = after.find((a) => a.id === result.incomingItemId)!;

        console.log(`  -> ${result.incomingBand} took over bird#${result.birdNo}`);
        console.log(
          `     replacement: bird#${inAfter.birdNo} perch=${inAfter.perchFeeValue ?? "—"}` +
            ` entry=${inAfter.entryFeeValue ?? "—"} paid=${inAfter.entryFeePaid ?? "—"}` +
            ` hs=${inAfter.hotSpotFeeValue ?? "—"} backup=${inAfter.isBackup} active=${inAfter.bird?.isActive}`
        );
        console.log(
          `     outgoing   : bird#${outAfter.birdNo ?? "—"} perch=${outAfter.perchFeeValue ?? "—"}` +
            ` entry=${outAfter.entryFeeValue ?? "—"} paid=${outAfter.entryFeePaid}` +
            ` betsRefund=${outAfter.betsRefund ?? "—"} replacedBy=${outAfter.replacedItemId} active=${outAfter.bird?.isActive}`
        );

        // Assertions mirroring the legacy contract.
        const problems: string[] = [];
        if (inAfter.birdNo !== outgoing.birdNo) problems.push("replacement did not inherit the bird number");
        if (inAfter.perchFeeValue !== outgoing.perchFeeValue) problems.push("perch fee not transferred");
        if (inAfter.entryFeeValue !== outgoing.entryFeeValue) problems.push("entry fee not transferred");
        if (inAfter.hotSpotFeeValue !== outgoing.hotSpotFeeValue) problems.push("hotspot fee not transferred");
        if (inAfter.isBackup === 1) problems.push("replacement still flagged as a backup");
        if (outAfter.birdNo != null) problems.push("outgoing bird kept its number");
        if (outAfter.perchFeeValue != null) problems.push("outgoing bird kept its perch fee");
        if (outAfter.entryFeePaid !== 0) problems.push("outgoing bird still marked paid");
        if (outAfter.replacedItemId !== result.incomingItemId) problems.push("replacement link not set");
        if (outAfter.bird?.isActive !== 0) problems.push("outgoing bird not deactivated");

        if (problems.length === 0) {
          console.log("     PASS — matches the legacy substitution contract\n");
        } else {
          console.log(`     FAIL — ${problems.join("; ")}\n`);
        }

        throw new Rollback();
      });
    } catch (e) {
      if (!(e instanceof Rollback)) {
        console.log(`     ERROR — ${e instanceof Error ? e.message : String(e)}\n`);
      }
    }
  }

  console.log("All changes rolled back; no live data was modified.");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
