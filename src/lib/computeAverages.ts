import { prisma } from "@/lib/prisma";
import { AverageFilterMode } from "@/generated/prisma/enums";

export interface AverageResultRow {
  rank: number | null;
  birdId: number;
  band: string;
  color: string | null;
  sex: number | null;
  breederId: number | null;
  breederName: string;
  loft: string | null;
  racesFlown: number;
  totalDistanceMiles: number | null;
  totalTimeMinutes: number | null;
  avgSpeedYPM: number | null; // yards per minute
}

export async function computeAverageResults(
  configId: number,
  seasonId: number
): Promise<AverageResultRow[]> {
  const config = await prisma.averageConfig.findUnique({
    where: { id: configId },
    include: {
      selectedRaceTypes: true,
      selectedRaces: true,
    },
  });
  if (!config) throw new Error("Config not found");

  // Resolve qualifying race IDs for this season
  const raceWhere: Record<string, unknown> = { seasonId };

  if (config.filterMode === AverageFilterMode.BY_TYPE) {
    raceWhere.raceTypeId = { in: config.selectedRaceTypes.map((r) => r.raceTypeId) };
  } else if (config.filterMode === AverageFilterMode.MANUAL) {
    raceWhere.id = { in: config.selectedRaces.map((r) => r.raceId) };
  } else if (config.filterMode === AverageFilterMode.COMBINATION) {
    const typeIds = config.selectedRaceTypes.map((r) => r.raceTypeId);
    const raceIds = config.selectedRaces.map((r) => r.raceId);
    raceWhere.OR = [
      { raceTypeId: { in: typeIds } },
      { id: { in: raceIds } },
    ];
  }
  // ALL: no extra filter

  const qualifyingRaces = await prisma.race.findMany({
    where: raceWhere,
    select: {
      id: true,
      startTime: true,
      distance: true,
      raceStation: { select: { miles: true, km: true } },
    },
  });

  const raceMap = new Map(qualifyingRaces.map((r) => [r.id, r]));
  const qualifyingRaceIds = qualifyingRaces.map((r) => r.id);

  // All birds registered in this season
  const inventoryItems = await prisma.eventInventoryItem.findMany({
    where: { eventInventory: { seasonId } },
    select: {
      id: true,
      bird: { select: { id: true, band1: true, band2: true, band3: true, band4: true, color: true, sex: true } },
      eventInventory: {
        select: {
          loft: true,
          breeder: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      raceItems: {
        where: { raceId: { in: qualifyingRaceIds }, result: { arrivalTime: { not: null } } },
        select: {
          raceId: true,
          result: { select: { arrivalTime: true } },
        },
      },
    },
  });

  // Compute per bird
  const rows: AverageResultRow[] = inventoryItems
    .filter((item) => item.bird != null)
    .map((item) => {
      const bird = item.bird!;
      const breeder = item.eventInventory?.breeder ?? null;
      const band = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-");

      let totalDistanceMiles = 0;
      let totalTimeMinutes = 0;
      let racesFlown = 0;

      for (const ri of item.raceItems) {
        const race = raceMap.get(ri.raceId ?? -1);
        if (!race || !ri.result?.arrivalTime || !race.startTime) continue;

        const distanceMiles = race.raceStation?.miles ?? race.distance ?? 0;
        if (distanceMiles === 0) continue;

        const flightMs = ri.result.arrivalTime.getTime() - race.startTime.getTime();
        if (flightMs <= 0) continue;

        totalDistanceMiles += distanceMiles;
        totalTimeMinutes += flightMs / 60000;
        racesFlown++;
      }

      const avgSpeedYPM =
        racesFlown > 0 && totalTimeMinutes > 0
          ? (totalDistanceMiles * 1760) / totalTimeMinutes
          : null;

      return {
        rank: null,
        birdId: bird.id,
        band,
        color: bird.color,
        sex: bird.sex,
        breederId: breeder?.id ?? null,
        breederName: breeder ? `${breeder.firstName ?? ""} ${breeder.lastName ?? ""}`.trim() : "Unknown",
        loft: item.eventInventory?.loft ?? null,
        racesFlown,
        totalDistanceMiles: racesFlown > 0 ? totalDistanceMiles : null,
        totalTimeMinutes: racesFlown > 0 ? totalTimeMinutes : null,
        avgSpeedYPM,
      };
    });

  // Sort: ranked birds (avgSpeed desc) first, then non-participants
  rows.sort((a, b) => {
    if (a.avgSpeedYPM === null && b.avgSpeedYPM === null) return 0;
    if (a.avgSpeedYPM === null) return 1;
    if (b.avgSpeedYPM === null) return -1;
    return b.avgSpeedYPM - a.avgSpeedYPM;
  });

  // Assign ranks (only birds that flew)
  let rank = 1;
  for (const row of rows) {
    if (row.avgSpeedYPM !== null) {
      row.rank = rank++;
    }
  }

  return rows;
}
