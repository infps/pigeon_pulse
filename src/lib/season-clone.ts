/**
 * Season carry-forward — stand up next season from the last one.
 *
 * HayLoft had P_CLONE_RACE, P_CLONE_EVENT_INVENTORY and
 * P_CLONE_EVENT_INVENTORY_ITEM, but they were hardcoded one-off scripts (event
 * 17 to event 18, with the IDs written into the procedure body). The intent is
 * worth keeping; the implementation is not. This is the reusable version the
 * reference document lists as "Season config carry-forward — Planned".
 *
 * What is copied is configuration, never results: schemes, stations, race
 * structure, prize values, status presets and average configs. Races arrive as
 * fresh REGISTERING races with no times, weather or transport state, because a
 * cloned race has not been flown.
 *
 * Registrations are opt-in and copy the roster only — breeder, loft and bird
 * entries with their fee fields recalculated, never payments, bets, baskets,
 * groups or results.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recalcPerchFeesForSeason } from "@/lib/bird-substitution";

type Tx = Prisma.TransactionClient;

export interface CloneOptions {
  name: string;
  startDate: Date;
  endDate: Date;
  /** Make the new season the active one for its event. */
  activate?: boolean;
  include?: {
    /** Fee, betting and the five prize scheme assignments. */
    schemes?: boolean;
    /** Liberation points and their race-type links. */
    stations?: boolean;
    /** Race structure — type, number, name, station, distance. No results. */
    races?: boolean;
    /** Per-season prize amounts for each band. */
    prizeValues?: boolean;
    /** Configurable display statuses. */
    statusPresets?: boolean;
    /** Average scoring configuration, remapped onto the cloned races. */
    averageConfigs?: boolean;
    /** Race number ranges per number group. */
    raceNumbers?: boolean;
    /** Calcutta auction settings, reset to the SETUP phase. */
    calcutta?: boolean;
    /** Breeders and their bird entries. Fees are recalculated, not copied. */
    registrations?: boolean;
  };
}

export interface CloneSummary {
  sourceSeasonId: number;
  newSeasonId: number;
  newSeasonName: string;
  copied: Record<string, number>;
  skipped: string[];
}

const DEFAULT_INCLUDE: Required<NonNullable<CloneOptions["include"]>> = {
  schemes: true,
  stations: true,
  races: true,
  prizeValues: true,
  statusPresets: true,
  averageConfigs: true,
  raceNumbers: true,
  calcutta: false,
  registrations: false,
};

async function cloneStations(
  tx: Tx,
  sourceSeasonId: number,
  newSeasonId: number
): Promise<{ count: number; idMap: Map<number, number> }> {
  const stations = await tx.raceStation.findMany({
    where: { seasonId: sourceSeasonId },
    include: { stationRaceTypes: { select: { raceTypeId: true } } },
  });

  const idMap = new Map<number, number>();
  for (const station of stations) {
    const created = await tx.raceStation.create({
      data: {
        seasonId: newSeasonId,
        name: station.name,
        miles: station.miles,
        km: station.km,
        latitude: station.latitude,
        longitude: station.longitude,
        isActive: station.isActive,
      },
      select: { id: true },
    });
    idMap.set(station.id, created.id);

    if (station.stationRaceTypes.length > 0) {
      await tx.raceStationRaceType.createMany({
        data: station.stationRaceTypes.map((rt) => ({
          stationId: created.id,
          raceTypeId: rt.raceTypeId,
        })),
      });
    }
  }

  return { count: stations.length, idMap };
}

async function cloneRaces(
  tx: Tx,
  sourceSeasonId: number,
  newSeasonId: number,
  stationIdMap: Map<number, number>
): Promise<{ count: number; idMap: Map<number, number> }> {
  const races = await tx.race.findMany({
    where: { seasonId: sourceSeasonId },
    orderBy: { raceNumber: "asc" },
  });

  const idMap = new Map<number, number>();
  for (const race of races) {
    const created = await tx.race.create({
      data: {
        seasonId: newSeasonId,
        raceTypeId: race.raceTypeId,
        raceNumber: race.raceNumber,
        name: race.name,
        description: race.description,
        distance: race.distance,
        location: race.location,
        // A station only carries over if stations were cloned too; otherwise the
        // new season points at nothing rather than at last season's station.
        raceStationId:
          race.raceStationId != null ? (stationIdMap.get(race.raceStationId) ?? null) : null,
        youtubeUrl: null,
        // Everything below is race-day state, deliberately left unset.
        status: "REGISTERING",
        transportStatus: "IDLE",
        bettingOpen: false,
        isLive: false,
        isClosed: 0,
      },
      select: { id: true },
    });
    idMap.set(race.id, created.id);
  }

  return { count: races.length, idMap };
}

async function clonePrizeValues(
  tx: Tx,
  sourceSeasonId: number,
  newSeasonId: number
): Promise<number> {
  const values = await tx.prizeValue.findMany({ where: { seasonId: sourceSeasonId } });
  if (values.length === 0) return 0;

  await tx.prizeValue.createMany({
    data: values.map((v) => ({
      seasonId: newSeasonId,
      prizeSchemeItemId: v.prizeSchemeItemId,
      raceTypeId: v.raceTypeId,
      prizeValue: v.prizeValue,
    })),
  });
  return values.length;
}

async function cloneStatusPresets(
  tx: Tx,
  sourceSeasonId: number,
  newSeasonId: number
): Promise<number> {
  const presets = await tx.birdStatusPreset.findMany({ where: { seasonId: sourceSeasonId } });
  if (presets.length === 0) return 0;

  await tx.birdStatusPreset.createMany({
    data: presets.map((p) => ({
      seasonId: newSeasonId,
      code: p.code,
      label: p.label,
      color: p.color,
      trigger: p.trigger,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    })),
  });
  return presets.length;
}

async function cloneAverageConfigs(
  tx: Tx,
  sourceSeasonId: number,
  newSeasonId: number,
  raceIdMap: Map<number, number>
): Promise<number> {
  const configs = await tx.averageConfig.findMany({
    where: { seasonId: sourceSeasonId },
    include: {
      selectedRaceTypes: { select: { raceTypeId: true } },
      selectedRaces: { select: { raceId: true } },
    },
  });

  for (const config of configs) {
    const created = await tx.averageConfig.create({
      data: {
        seasonId: newSeasonId,
        name: config.name,
        filterMode: config.filterMode,
        isPublic: config.isPublic,
      },
      select: { id: true },
    });

    if (config.selectedRaceTypes.length > 0) {
      await tx.averageConfigRaceType.createMany({
        data: config.selectedRaceTypes.map((rt) => ({
          configId: created.id,
          raceTypeId: rt.raceTypeId,
        })),
      });
    }

    // Hand-picked races only survive if their clone exists.
    const remapped = config.selectedRaces
      .map((r) => (r.raceId != null ? raceIdMap.get(r.raceId) : undefined))
      .filter((id): id is number => id != null);

    if (remapped.length > 0) {
      await tx.averageConfigRace.createMany({
        data: remapped.map((raceId) => ({ configId: created.id, raceId })),
      });
    }
  }

  return configs.length;
}

async function cloneRegistrations(
  tx: Tx,
  sourceSeasonId: number,
  newSeasonId: number
): Promise<{ inventories: number; items: number }> {
  const inventories = await tx.eventInventory.findMany({
    where: { seasonId: sourceSeasonId },
    include: {
      items: {
        // A bird that was replaced last season should not reappear in the new
        // roster as if it were still flying.
        where: { replacedItemId: null },
        select: { birdId: true, birdNo: true, isBackup: true },
        orderBy: { birdNo: "asc" },
      },
    },
  });

  let itemCount = 0;

  for (const inv of inventories) {
    if (inv.breederId == null) continue;

    const created = await tx.eventInventory.create({
      data: {
        seasonId: newSeasonId,
        breederId: inv.breederId,
        teamId: inv.teamId,
        loft: inv.loft,
        note: inv.note,
        reservedBirds: inv.reservedBirds,
        // Last season's sign-in, waitlist and cash promise mean nothing here.
        isWaiting: inv.isWaiting,
      },
      select: { id: true },
    });

    const rows = inv.items
      .filter((item) => item.birdId != null)
      .map((item) => ({
        eventInventoryId: created.id,
        birdId: item.birdId!,
        birdNo: item.birdNo,
        isBackup: item.isBackup,
        // Fees are priced from the new season's scheme below, not copied.
        entryFeePaid: 0,
      }));

    if (rows.length > 0) {
      await tx.eventInventoryItem.createMany({ data: rows });
      itemCount += rows.length;
    }
  }

  // Price the whole copied roster in one pass. Doing it per registration would
  // be thousands of round trips and would exhaust the transaction budget.
  await recalcPerchFeesForSeason(tx, newSeasonId);

  return { inventories: inventories.length, items: itemCount };
}

/**
 * Copy a season's configuration into a new season under the same event.
 */
export async function cloneSeason(
  sourceSeasonId: number,
  options: CloneOptions
): Promise<CloneSummary> {
  const include = { ...DEFAULT_INCLUDE, ...(options.include ?? {}) };

  return prisma.$transaction(
    async (tx) => {
      const source = await tx.season.findUnique({
        where: { id: sourceSeasonId },
        select: {
          id: true,
          eventId: true,
          feeSchemeId: true,
          bettingSchemeId: true,
          finalPrizeSchemeId: true,
          hotSpot1PrizeSchemeId: true,
          hotSpot2PrizeSchemeId: true,
          hotSpot3PrizeSchemeId: true,
          hotSpotAvgPrizeSchemeId: true,
          calcuttaConfig: true,
        },
      });

      if (!source) throw new Error("The season you are copying from no longer exists.");
      if (options.endDate < options.startDate) {
        throw new Error("The new season cannot end before it starts.");
      }

      const copied: Record<string, number> = {};
      const skipped: string[] = [];

      const newSeason = await tx.season.create({
        data: {
          eventId: source.eventId,
          name: options.name,
          startDate: options.startDate,
          endDate: options.endDate,
          isActive: false,
          ...(include.schemes
            ? {
                feeSchemeId: source.feeSchemeId,
                bettingSchemeId: source.bettingSchemeId,
                finalPrizeSchemeId: source.finalPrizeSchemeId,
                hotSpot1PrizeSchemeId: source.hotSpot1PrizeSchemeId,
                hotSpot2PrizeSchemeId: source.hotSpot2PrizeSchemeId,
                hotSpot3PrizeSchemeId: source.hotSpot3PrizeSchemeId,
                hotSpotAvgPrizeSchemeId: source.hotSpotAvgPrizeSchemeId,
              }
            : {}),
        },
        select: { id: true, name: true },
      });

      if (include.schemes) {
        copied.schemes = [
          source.feeSchemeId,
          source.bettingSchemeId,
          source.finalPrizeSchemeId,
          source.hotSpot1PrizeSchemeId,
          source.hotSpot2PrizeSchemeId,
          source.hotSpot3PrizeSchemeId,
          source.hotSpotAvgPrizeSchemeId,
        ].filter((id) => id != null).length;
      }

      let stationIdMap = new Map<number, number>();
      if (include.stations) {
        const result = await cloneStations(tx, sourceSeasonId, newSeason.id);
        stationIdMap = result.idMap;
        copied.stations = result.count;
      }

      let raceIdMap = new Map<number, number>();
      if (include.races) {
        const result = await cloneRaces(tx, sourceSeasonId, newSeason.id, stationIdMap);
        raceIdMap = result.idMap;
        copied.races = result.count;
        if (!include.stations && result.count > 0) {
          skipped.push("Cloned races have no liberation station, because stations were not copied.");
        }
      }

      if (include.prizeValues) {
        copied.prizeValues = await clonePrizeValues(tx, sourceSeasonId, newSeason.id);
      }

      if (include.statusPresets) {
        copied.statusPresets = await cloneStatusPresets(tx, sourceSeasonId, newSeason.id);
      }

      if (include.raceNumbers) {
        const numbers = await tx.eventRaceNumber.findMany({ where: { seasonId: sourceSeasonId } });
        if (numbers.length > 0) {
          await tx.eventRaceNumber.createMany({
            data: numbers.map((n) => ({
              seasonId: newSeason.id,
              numberGroupId: n.numberGroupId,
              numberRangeFrom: n.numberRangeFrom,
              numberRangeTo: n.numberRangeTo,
            })),
          });
        }
        copied.raceNumbers = numbers.length;
      }

      if (include.averageConfigs) {
        copied.averageConfigs = await cloneAverageConfigs(
          tx,
          sourceSeasonId,
          newSeason.id,
          raceIdMap
        );
      }

      if (include.calcutta && source.calcuttaConfig) {
        const c = source.calcuttaConfig;
        await tx.calcuttaConfig.create({
          data: {
            seasonId: newSeason.id,
            pricePerBird: c.pricePerBird,
            targetGroupSize: c.targetGroupSize,
            biddingDuration: c.biddingDuration,
            antiSnipeDuration: c.antiSnipeDuration,
            bidRaiseOptions: c.bidRaiseOptions,
            // Auction state never carries forward.
            phase: "SETUP",
            youtubeStreamUrl: null,
            activeGroupId: null,
          },
        });
        copied.calcutta = 1;
      }

      if (include.registrations) {
        const result = await cloneRegistrations(tx, sourceSeasonId, newSeason.id);
        copied.registrations = result.inventories;
        copied.registeredBirds = result.items;
        if (!include.races) {
          skipped.push(
            "Copied registrations have no race entries, because races were not copied."
          );
        }
      }

      if (options.activate) {
        await tx.season.updateMany({
          where: { eventId: source.eventId, isActive: true },
          data: { isActive: false },
        });
        await tx.season.update({ where: { id: newSeason.id }, data: { isActive: true } });
      }

      return {
        sourceSeasonId,
        newSeasonId: newSeason.id,
        newSeasonName: newSeason.name,
        copied,
        skipped,
      };
    },
    { maxWait: 20000, timeout: 180000 }
  );
}
