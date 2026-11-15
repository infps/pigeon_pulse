/**
 * Everything about one bird, for the bird popup (web and mobile).
 *
 * One payload, three levels of access:
 *   admin  — everything, plus what an admin may move the bird to
 *   owner  — the bird's breeder, or a breeder on its registration (owner or
 *            partner): everything about their own bird, no move options
 *   public — anyone else: the bird and its race record, no fees, notes or
 *            account
 *
 * The money figures are HayLoft's (lib/hayloft-account): the bird's own fees,
 * refunds and prizes, and its registration's account.
 */

import { prisma } from "@/lib/prisma";
import { seasonAccounts } from "@/lib/hayloft-account";
import { itemBetsValue } from "@/lib/hayloft-account";
import { flightTimeMs, speeds, timeOfDay, wallClock } from "@/lib/hayloft-avg-speed";

export type BirdCardAccess = "admin" | "owner" | "public";

const name = (b: { firstName: string | null; lastName: string | null } | null | undefined) =>
  b ? [b.firstName, b.lastName].filter(Boolean).join(" ") : "";
const bandOf = (b: { band1: string | null; band2: string | null; band3: string | null; band4: string | null; band: string | null }) =>
  [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") || b.band || "";

export async function birdCard(
  birdId: number,
  viewer: { userId: string; isAdmin: boolean },
  opts: { seasonId?: number | null; eventId?: number | null } = {}
) {
  const birdQ = prisma.bird.findUnique({
    where: { id: birdId },
    select: {
      id: true, band: true, band1: true, band2: true, band3: true, band4: true, birdName: true, color: true,
      sex: true, rfid: true, image: true, isActive: true, isLost: true, lostDate: true, note: true, attention: true,
      healthStatus: true, healthNote: true, isPublic: true,
      lostRace: { select: { id: true, name: true, raceNumber: true } },
      father: { select: { id: true, band: true, band1: true, band2: true, band3: true, band4: true, birdName: true } },
      mother: { select: { id: true, band: true, band1: true, band2: true, band3: true, band4: true, birdName: true } },
      breeder: { select: { id: true, firstName: true, lastName: true, userId: true } },
    },
  });
  // The bird's entries, newest first; the one shown is the asked-for season's.
  const entriesQ = prisma.eventInventoryItem.findMany({
    where: { birdId, deletedAt: null },
    orderBy: { id: "desc" },
    select: {
      id: true, birdNo: true, isBackup: true, arrivalDate: true, departureDate: true, replacedItemId: true,
      entryFeeValue: true, entryFeePaid: true, perchFeeValue: true, hotSpotFeeValue: true, raceFeeValue: true,
      transferDue: true, entryRefund: true, hotSpotRefund: true, betsRefund: true, isBetActive: true,
      belgianShowBet1: true, belgianShowBet2: true, belgianShowBet3: true, belgianShowBet4: true,
      belgianShowBet5: true, belgianShowBet6: true, belgianShowBet7: true,
      standardShowBet1: true, standardShowBet2: true, standardShowBet3: true,
      standardShowBet4: true, standardShowBet5: true, standardShowBet6: true,
      wtaBet1: true, wtaBet2: true, wtaBet3: true, wtaBet4: true, wtaBet5: true,
      currentGroup: { select: { id: true, name: true, color: true } },
      tagColorGroup: { select: { id: true, name: true, color: true } },
      basketAssignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          id: true, assignedAt: true,
          eventBasket: { select: { id: true, basketNo: true, label: true, phase: true, capacity: true, race: { select: { id: true, name: true, raceNumber: true } } } },
        },
      },
      breederHistory: { orderBy: { transferredAt: "desc" }, select: { fromBreederName: true, transferredAt: true } },
      eventInventory: {
        select: {
          id: true, loft: true, signInDate: true, seasonId: true, approvalStatus: true,
          breeder: { select: { id: true, firstName: true, lastName: true, userId: true } },
          partners: { select: { breeder: { select: { id: true, firstName: true, lastName: true, userId: true } } } },
          season: {
            select: {
              id: true, name: true, eventId: true,
              event: { select: { id: true, name: true } },
              bettingScheme: true,
            },
          },
        },
      },
    },
  });

  // Race record and lost history do not depend on the entry: start them now.
  const raceItemsQ = prisma.raceItem.findMany({
    where: { inventoryItem: { birdId } },
    orderBy: { id: "desc" },
    select: {
      id: true, status: true, isLost: true,
      race: {
        select: {
          id: true, name: true, raceNumber: true, startTime: true, distance: true, sunrise: true, sunset: true, status: true,
          raceType: { select: { name: true } },
          seasonRel: { select: { name: true, event: { select: { name: true } } } },
        },
      },
      result: { select: { arrivalTime: true, birdPosition: true, birdPositionHotSpot: true, birdDrop: true, prizeValue: true } },
    },
  });
  const lostHistoryQ = prisma.lostHistory.findMany({
    where: { birdId },
    orderBy: { id: "desc" },
    select: { isLost: true, lostDate: true, race: { select: { name: true, raceNumber: true } } },
  });
  const [bird, entries] = await Promise.all([birdQ, entriesQ]);
  if (!bird) return null;

  const entry =
    (opts.seasonId != null && entries.find((e) => e.eventInventory?.seasonId === opts.seasonId)) ||
    (opts.eventId != null && entries.find((e) => e.eventInventory?.season?.eventId === opts.eventId)) ||
    entries[0] ||
    null;

  // Who is looking.
  const reg = entry?.eventInventory;
  const ownerUserIds = new Set(
    [bird.breeder?.userId, reg?.breeder?.userId, ...(reg?.partners ?? []).map((p) => p.breeder?.userId)].filter(Boolean) as string[]
  );
  const access: BirdCardAccess = viewer.isAdmin ? "admin" : ownerUserIds.has(viewer.userId) ? "owner" : "public";
  const full = access !== "public";

  // HayLoft's account for the registration (only shown to admin / owner).
  const accountQ = full && entry && reg?.seasonId != null
    ? seasonAccounts(reg.seasonId, { inventoryIds: [reg.id] })
    : Promise.resolve(null);
  const [raceItems, lostHistory, seasonAcc] = await Promise.all([raceItemsQ, lostHistoryQ, accountQ]);

  // Race record, every race the bird has been entered in.
  const races = raceItems.map((ri) => {
    const r = ri.race;
    let yardsPerMin: number | null = null;
    if (r?.startTime && ri.result?.arrivalTime && (r.distance ?? 0) > 0) {
      const ms = flightTimeMs(
        wallClock(r.startTime),
        wallClock(ri.result.arrivalTime),
        r.sunrise ? timeOfDay(r.sunrise) : null,
        r.sunset ? timeOfDay(r.sunset) : null
      );
      yardsPerMin = speeds(r.distance ?? 0, ms).yardsPerMin;
    }
    return {
      raceItemId: ri.id,
      raceId: r?.id ?? null,
      race: r?.name || (r?.raceNumber != null ? `Race ${r.raceNumber}` : "Race"),
      raceType: r?.raceType?.name ?? null,
      event: r?.seasonRel?.event?.name ?? null,
      season: r?.seasonRel?.name ?? null,
      date: r?.startTime ?? null,
      distance: r?.distance ?? null,
      status: ri.status,
      lost: ri.isLost === 1,
      arrival: ri.result?.arrivalTime ?? null,
      position: ri.result?.birdPosition ?? null,
      hotSpotPosition: ri.result?.birdPositionHotSpot ?? null,
      drop: ri.result?.birdDrop ?? null,
      yardsPerMin,
      prize: full ? ri.result?.prizeValue ?? null : null,
    };
  });

  // HayLoft's account for the registration, and this bird's prizes in it.
  let account: null | { charges: number; payments: number; won: number; balance: number } = null;
  let birdPrizes: null | { capital: number; hotSpot1: number; hotSpot2: number; avgSpeed: number; bets: number } = null;
  if (seasonAcc && entry) {
    const a = seasonAcc.accounts[0];
    if (a) {
      const r2 = (n: number) => Math.round(n * 100) / 100;
      account = {
        charges: r2(a.perchFee + a.entryFee + a.hotSpotFee + a.betsValue + a.raceFee + a.poolStakes + a.transferDue - a.entryRefund - a.betsRefund - a.hotSpotRefund),
        payments: r2(a.totalPayment),
        won: r2(a.winnerPayoutValue),
        balance: r2(a.balance),
      };
      birdPrizes = a.birdPrizes.find((p) => p.inventoryItemId === entry.id) ?? null;
    }
  }

  return {
    access,
    bird: {
      id: bird.id,
      band: bandOf(bird),
      bands: [bird.band1, bird.band2, bird.band3, bird.band4],
      name: bird.birdName,
      color: bird.color,
      sex: bird.sex, // 0 cock, 1 hen, 2 unknown
      rfid: bird.rfid,
      image: bird.image,
      active: bird.isActive === 1,
      lost: bird.isLost === 1,
      lostDate: bird.lostDate,
      lostRace: bird.lostRace ? bird.lostRace.name || `Race ${bird.lostRace.raceNumber ?? ""}`.trim() : null,
      health: bird.healthStatus,
      healthNote: full ? bird.healthNote : null,
      note: full ? bird.note : null,
      attention: bird.attention,
      father: bird.father ? { id: bird.father.id, band: bandOf(bird.father), name: bird.father.birdName } : null,
      mother: bird.mother ? { id: bird.mother.id, band: bandOf(bird.mother), name: bird.mother.birdName } : null,
      owner: bird.breeder ? { breederId: bird.breeder.id, name: name(bird.breeder) } : null,
    },
    entry: entry
      ? {
          inventoryItemId: entry.id,
          eventInventoryId: reg?.id ?? null,
          event: reg?.season?.event?.name ?? null,
          eventId: reg?.season?.eventId ?? null,
          season: reg?.season?.name ?? null,
          seasonId: reg?.seasonId ?? null,
          registrationOwner: reg?.breeder ? { breederId: reg.breeder.id, name: name(reg.breeder) } : null,
          partners: (reg?.partners ?? []).map((p) => name(p.breeder)).filter(Boolean),
          loft: reg?.loft ?? null,
          approval: reg?.approvalStatus ?? null,
          signInDate: reg?.signInDate ?? null,
          perch: entry.birdNo, // HayLoft's BIRD_NO: the bird's perch number
          backup: entry.isBackup === 1,
          replaced: entry.replacedItemId != null,
          arrivalDate: entry.arrivalDate,
          departureDate: entry.departureDate,
          loftGroup: entry.currentGroup,
          tagColor: entry.tagColorGroup,
          baskets: entry.basketAssignments.map((ba) => ({
            assignmentId: ba.id,
            basketId: ba.eventBasket.id,
            label: ba.eventBasket.label ?? `Basket ${ba.eventBasket.basketNo}`,
            basketNo: ba.eventBasket.basketNo,
            phase: ba.eventBasket.phase,
            race: ba.eventBasket.race ? ba.eventBasket.race.name || `Race ${ba.eventBasket.race.raceNumber ?? ""}`.trim() : null,
            raceId: ba.eventBasket.race?.id ?? null,
            assignedAt: ba.assignedAt,
          })),
          ownerHistory: entry.breederHistory,
          fees: full
            ? {
                perch: entry.perchFeeValue ?? 0,
                entry: entry.entryFeeValue ?? 0,
                entryPaid: entry.entryFeePaid === 1,
                hotSpot: entry.hotSpotFeeValue ?? 0,
                race: entry.raceFeeValue ?? 0,
                bets: itemBetsValue(entry, reg?.season?.bettingScheme ?? null),
                betsActive: entry.isBetActive == null || entry.isBetActive !== 0,
                transferDue: entry.transferDue ?? 0,
                entryRefund: entry.entryRefund ?? 0,
                hotSpotRefund: entry.hotSpotRefund ?? 0,
                betsRefund: entry.betsRefund ?? 0,
              }
            : null,
          prizes: birdPrizes,
          account,
        }
      : null,
    otherEntries: entries
      .filter((e) => e !== entry)
      .map((e) => ({ inventoryItemId: e.id, event: e.eventInventory?.season?.event?.name ?? null, season: e.eventInventory?.season?.name ?? null, seasonId: e.eventInventory?.seasonId ?? null })),
    races,
    lostHistory: lostHistory.map((l) => ({
      lost: l.isLost === 1,
      date: l.lostDate,
      race: l.race ? l.race.name || `Race ${l.race.raceNumber ?? ""}`.trim() : null,
    })),
  };
}

/** What an admin may move the bird's entry to (popup's move controls). */
export async function birdMoveOptions(inventoryItemId: number) {
  const item = await prisma.eventInventoryItem.findUnique({
    where: { id: inventoryItemId },
    select: { eventInventoryId: true, eventInventory: { select: { seasonId: true } } },
  });
  const seasonId = item?.eventInventory?.seasonId;
  if (!item || seasonId == null) return null;
  const [perches, groups, baskets, registrations] = await Promise.all([
    prisma.eventInventoryItem.count({ where: { eventInventoryId: item.eventInventoryId, deletedAt: null, birdNo: { not: null } } }),
    prisma.eventGroup.findMany({ where: { seasonId, type: "LOFT" }, select: { id: true, name: true, color: true, capacity: true }, orderBy: { name: "asc" } }),
    prisma.eventBasket.findMany({
      where: { seasonId },
      orderBy: [{ phase: "asc" }, { basketNo: "asc" }],
      select: { id: true, basketNo: true, label: true, phase: true, capacity: true, race: { select: { id: true, name: true, raceNumber: true } }, _count: { select: { assignments: true } } },
    }),
    prisma.eventInventory.findMany({
      where: { seasonId, approvalStatus: "APPROVED" },
      select: { id: true, loft: true, breeder: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ breeder: { lastName: "asc" } }, { breeder: { firstName: "asc" } }],
    }),
  ]);
  return {
    perchCount: perches,
    groups,
    baskets: baskets.map((b) => ({
      id: b.id,
      label: b.label ?? `Basket ${b.basketNo}`,
      phase: b.phase,
      race: b.race ? b.race.name || `Race ${b.race.raceNumber ?? ""}`.trim() : null,
      raceId: b.race?.id ?? null,
      capacity: b.capacity,
      used: b._count.assignments,
    })),
    registrations: registrations
      .filter((r) => r.id !== item.eventInventoryId)
      .map((r) => ({ id: r.id, breederId: r.breeder?.id ?? null, name: name(r.breeder), loft: r.loft })),
  };
}
