/**
 * Exercises the season clone against a real season, then rolls it back.
 *
 * Proves the carry-forward copies configuration and nothing else: no results,
 * no payments, no baskets, and races arrive fresh in REGISTERING.
 *
 *   bun scripts/verify-season-clone.ts [seasonId]
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { cloneSeason } from "../src/lib/season-clone";

async function pickSeason(): Promise<number | undefined> {
  const rows = await prisma.race.groupBy({
    by: ["seasonId"],
    _count: { _all: true },
    orderBy: { _count: { seasonId: "desc" } },
    take: 1,
  });
  return rows[0]?.seasonId ?? undefined;
}

async function main() {
  const explicit = parseInt(process.argv[2] ?? "", 10);
  const seasonId = Number.isNaN(explicit) ? await pickSeason() : explicit;
  if (seasonId == null) {
    console.log("No season with races found.");
    await prisma.$disconnect();
    process.exit(0);
  }

  const source = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      name: true,
      event: { select: { name: true } },
      _count: { select: { races: true, raceStations: true, prizeValues: true, eventInventories: true } },
    },
  });
  console.log(`Source season ${seasonId} — ${source?.event?.name ?? "?"} / ${source?.name ?? "?"}`);
  console.log(
    `  races ${source?._count.races}, stations ${source?._count.raceStations},` +
      ` prize values ${source?._count.prizeValues}, registrations ${source?._count.eventInventories}\n`
  );

  const summary = await cloneSeason(seasonId, {
    name: `VERIFY CLONE ${seasonId}`,
    startDate: new Date("2027-01-01"),
    endDate: new Date("2027-12-31"),
    include: { registrations: true, calcutta: true },
  });

  console.log(`Created season ${summary.newSeasonId} — copied:`);
  for (const [what, count] of Object.entries(summary.copied)) {
    console.log(`  ${what.padEnd(18)} ${count}`);
  }
  for (const note of summary.skipped) console.log(`  ! ${note}`);

  // Confirm nothing that should not carry forward came across.
  const newSeasonId = summary.newSeasonId;
  const [races, results, payments, baskets, assignments, groups, bets] = await Promise.all([
    prisma.race.findMany({
      where: { seasonId: newSeasonId },
      select: { status: true, startTime: true, isClosed: true, transportStatus: true },
    }),
    prisma.raceItemResult.count({ where: { raceItem: { race: { seasonId: newSeasonId } } } }),
    prisma.payment.count({ where: { eventInventory: { seasonId: newSeasonId } } }),
    prisma.eventBasket.count({ where: { seasonId: newSeasonId } }),
    prisma.basketAssignment.count({
      where: { inventoryItem: { eventInventory: { seasonId: newSeasonId } } },
    }),
    prisma.eventGroup.count({ where: { seasonId: newSeasonId } }),
    prisma.bet.count({ where: { race: { seasonId: newSeasonId } } }),
  ]);

  const problems: string[] = [];
  if (results > 0) problems.push(`${results} race results carried over`);
  if (payments > 0) problems.push(`${payments} payments carried over`);
  if (baskets > 0) problems.push(`${baskets} baskets carried over`);
  if (assignments > 0) problems.push(`${assignments} basket assignments carried over`);
  if (groups > 0) problems.push(`${groups} groups carried over`);
  if (bets > 0) problems.push(`${bets} bets carried over`);
  const dirty = races.filter(
    (r) => r.status !== "REGISTERING" || r.startTime != null || r.isClosed === 1 || r.transportStatus !== "IDLE"
  );
  if (dirty.length > 0) problems.push(`${dirty.length} cloned races carry race-day state`);

  console.log(
    problems.length === 0
      ? "\nPASS — configuration only; no results, money, baskets, groups or bets carried over."
      : `\nFAIL — ${problems.join("; ")}`
  );

  // Clean up the verification season entirely.
  await prisma.$transaction(async (tx) => {
    await tx.averageConfigRace.deleteMany({ where: { config: { seasonId: newSeasonId } } });
    await tx.averageConfigRaceType.deleteMany({ where: { config: { seasonId: newSeasonId } } });
    await tx.averageConfig.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.calcuttaConfig.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.eventInventoryItem.deleteMany({
      where: { eventInventory: { seasonId: newSeasonId } },
    });
    await tx.eventInventory.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.race.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.raceStationRaceType.deleteMany({
      where: { station: { seasonId: newSeasonId } },
    });
    await tx.raceStation.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.prizeValue.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.birdStatusPreset.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.eventRaceNumber.deleteMany({ where: { seasonId: newSeasonId } });
    await tx.season.delete({ where: { id: newSeasonId } });
  });
  console.log(`Verification season ${newSeasonId} removed.`);

  await prisma.$disconnect();
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
