/**
 * Verification harness for the race result engine.
 *
 * Replays recalculation over races whose results came across from HayLoft and
 * reports how the engine's output differs from what the legacy system stored.
 * Every race runs as a dry run, so this never modifies data.
 *
 *   bun scripts/verify-prize-engine.ts            # all migrated prize races
 *   bun scripts/verify-prize-engine.ts 221 746    # specific races
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { recalcRace } from "../src/lib/race-results";

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

async function main() {
  const explicit = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));

  const races = explicit.length
    ? await prisma.race.findMany({
        where: { id: { in: explicit } },
        select: { id: true, seasonId: true, raceType: { select: { name: true, prizeRole: true } } },
      })
    : await prisma.race.findMany({
        where: {
          raceType: { prizeRole: { not: "NONE" } },
          raceItems: { some: { result: { prizeValue: { not: null } } } },
        },
        select: { id: true, seasonId: true, raceType: { select: { name: true, prizeRole: true } } },
        orderBy: { id: "asc" },
      });

  console.log(`Verifying ${races.length} race(s) against migrated HayLoft results.\n`);

  let exactMatches = 0;

  for (const race of races) {
    const stored = await prisma.raceItemResult.aggregate({
      where: { raceItem: { raceId: race.id } },
      _count: { birdPosition: true, prizeValue: true, birdPositionHotSpot: true },
      _sum: { prizeValue: true },
    });

    const summary = await recalcRace(race.id, { dryRun: true });

    const posDelta = summary.positionsAssigned - stored._count.birdPosition;
    const prizeDelta = summary.prizeTotal - (stored._sum.prizeValue ?? 0);
    const matches = summary.changedCount === 0;
    if (matches) exactMatches++;

    console.log(
      `Race ${race.id}  ${race.raceType?.name ?? "?"}  (season ${race.seasonId ?? "?"})  ${
        matches ? "IDENTICAL" : `${summary.changedCount} rows differ`
      }`
    );
    console.log(
      `   positions  legacy ${stored._count.birdPosition} -> engine ${summary.positionsAssigned}` +
        `  (${posDelta >= 0 ? "+" : ""}${posDelta})` +
        `   unpaid skipped ${summary.skippedUnpaid}, ignored ${summary.skippedIgnored}`
    );
    console.log(
      `   hotspot    legacy ${stored._count.birdPositionHotSpot} -> engine ${summary.hotspotPositionsAssigned}`
    );
    console.log(
      `   prizes     legacy ${stored._count.prizeValue} / ${money(stored._sum.prizeValue)}` +
        ` -> engine ${summary.prizesAwarded} / ${money(summary.prizeTotal)}` +
        `  (${prizeDelta >= 0 ? "+" : ""}${money(prizeDelta)})`
    );
    for (const w of summary.warnings) console.log(`   ! ${w}`);

    // Show the first few disagreements so a mismatch is diagnosable.
    for (const change of summary.changes.slice(0, 3)) {
      console.log(
        `     ${change.band ?? "band?"}  pos ${change.before.position ?? "—"}->${change.after.position ?? "—"}` +
          `  hs ${change.before.hotspotPosition ?? "—"}->${change.after.hotspotPosition ?? "—"}` +
          `  prize ${money(change.before.prize)}->${money(change.after.prize)}`
      );
    }
    console.log();
  }

  console.log(`${exactMatches}/${races.length} races reproduce HayLoft's stored results exactly.`);
  await prisma.$disconnect();
  // lib/prisma.ts starts a 4-minute keepalive timer that holds the event loop
  // open, so a script importing it never exits on its own.
  process.exit(exactMatches === races.length ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
