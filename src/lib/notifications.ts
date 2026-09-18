/**
 * Notifications — the triggers the reference document listed as planned.
 *
 * In-app delivery is the source of truth: rows in Notifications are what the
 * feed reads, and push can be layered on later by walking rows where
 * deliveredAt is null.
 *
 * Every trigger here is fire-and-forget. A notification failing must never take
 * down the operation that caused it — a race still starts even if the announcement
 * cannot be written — so callers use notifySafely and the errors are logged.
 */

import { prisma } from "@/lib/prisma";
import type { NotificationKind } from "@/generated/prisma/enums";

interface NewNotification {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string | null;
  seasonId?: number | null;
  raceId?: number | null;
}

/** Write notifications, swallowing failures so callers cannot be broken by them. */
export async function notifySafely(rows: NewNotification[]): Promise<number> {
  if (rows.length === 0) return 0;
  try {
    const result = await prisma.notification.createMany({
      data: rows.map((r) => ({
        userId: r.userId,
        kind: r.kind,
        title: r.title,
        body: r.body,
        link: r.link ?? null,
        seasonId: r.seasonId ?? null,
        raceId: r.raceId ?? null,
      })),
    });
    return result.count;
  } catch (error) {
    console.error("Failed to write notifications:", error);
    return 0;
  }
}

/** Every user with a bird entered in this race. */
async function usersInRace(raceId: number): Promise<string[]> {
  const rows = await prisma.raceItem.findMany({
    where: { raceId },
    select: {
      inventoryItem: {
        select: { eventInventory: { select: { breeder: { select: { userId: true } } } } },
      },
    },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    const userId = row.inventoryItem?.eventInventory?.breeder?.userId;
    if (userId) ids.add(userId);
  }
  return [...ids];
}

/** Every user registered in this season. */
async function usersInSeason(seasonId: number): Promise<string[]> {
  const rows = await prisma.eventInventory.findMany({
    where: { seasonId },
    select: { breeder: { select: { userId: true } } },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.breeder?.userId) ids.add(row.breeder.userId);
  }
  return [...ids];
}

async function raceLabel(raceId: number): Promise<{ name: string; seasonId: number | null }> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: {
      name: true,
      raceNumber: true,
      seasonId: true,
      raceType: { select: { name: true } },
    },
  });
  const name =
    race?.name ||
    (race?.raceNumber != null ? `Race ${race.raceNumber}` : null) ||
    race?.raceType?.name ||
    "the race";
  return { name, seasonId: race?.seasonId ?? null };
}

/** The race has been released. Everyone with a bird in it hears about it. */
export async function notifyRaceStarted(raceId: number): Promise<number> {
  const [{ name, seasonId }, userIds] = await Promise.all([raceLabel(raceId), usersInRace(raceId)]);
  return notifySafely(
    userIds.map((userId) => ({
      userId,
      kind: "RACE_STARTED" as const,
      title: `${name} has been released`,
      body: `Your birds are in the air. Follow arrivals as they are scanned.`,
      link: `/races/${raceId}`,
      seasonId,
      raceId,
    }))
  );
}

/** A bird is home. Only its owner is told, with the position. */
export async function notifyBirdArrived(
  raceId: number,
  inventoryItemId: number | null,
  band: string,
  position: number | null
): Promise<number> {
  if (inventoryItemId == null) return 0;

  const item = await prisma.eventInventoryItem.findUnique({
    where: { id: inventoryItemId },
    select: { eventInventory: { select: { breeder: { select: { userId: true } } } } },
  });
  const userId = item?.eventInventory?.breeder?.userId;
  if (!userId) return 0;

  const { name, seasonId } = await raceLabel(raceId);
  return notifySafely([
    {
      userId,
      kind: "BIRD_ARRIVED",
      title: position != null ? `${band} arrived — position ${position}` : `${band} arrived`,
      body: `Scanned in on ${name}.`,
      link: `/races/${raceId}`,
      seasonId,
      raceId,
    },
  ]);
}

/** The race is closed and the results stand. */
export async function notifyRaceEnded(
  raceId: number,
  lostCount: number
): Promise<number> {
  const [{ name, seasonId }, userIds] = await Promise.all([raceLabel(raceId), usersInRace(raceId)]);
  return notifySafely(
    userIds.map((userId) => ({
      userId,
      kind: "RACE_ENDED" as const,
      title: `${name} results are final`,
      body:
        lostCount > 0
          ? `Positions and prizes have been calculated. ${lostCount} bird${lostCount === 1 ? "" : "s"} did not return.`
          : `Positions and prizes have been calculated.`,
      link: `/races/${raceId}`,
      seasonId,
      raceId,
    }))
  );
}

/** Betting has opened on a race. */
export async function notifyBettingOpen(raceId: number): Promise<number> {
  const { name, seasonId } = await raceLabel(raceId);
  const userIds = seasonId != null ? await usersInSeason(seasonId) : await usersInRace(raceId);
  return notifySafely(
    userIds.map((userId) => ({
      userId,
      kind: "BETTING_OPEN" as const,
      title: `Betting is open on ${name}`,
      body: `Pools are accepting bets until the race starts.`,
      link: `/races/${raceId}`,
      seasonId,
      raceId,
    }))
  );
}

/** An admin has broadcast a message to the season. */
export async function notifyEventMessage(
  seasonId: number,
  title: string | null,
  body: string,
  eventId: number | null
): Promise<number> {
  const userIds = await usersInSeason(seasonId);
  const trimmed = body.length > 180 ? `${body.slice(0, 177)}…` : body;
  return notifySafely(
    userIds.map((userId) => ({
      userId,
      kind: "EVENT_MESSAGE" as const,
      title: title || "New message from the organizer",
      body: trimmed,
      link: eventId != null ? `/events/${eventId}` : null,
      seasonId,
    }))
  );
}

/**
 * Payment is outstanding ahead of a race that requires it.
 *
 * Takes the breeders it should warn rather than working them out, because the
 * defaulter rules already live in the defaulters route.
 */
export async function notifyPaymentDue(
  breederIds: number[],
  seasonId: number,
  raceId: number | null,
  raceName: string,
  eventId: number | null
): Promise<number> {
  if (breederIds.length === 0) return 0;

  const breeders = await prisma.breeder.findMany({
    where: { id: { in: breederIds }, userId: { not: null } },
    select: { userId: true },
  });

  return notifySafely(
    breeders
      .filter((b): b is { userId: string } => b.userId != null)
      .map((b) => ({
        userId: b.userId,
        kind: "PAYMENT_DUE" as const,
        title: `Payment due before ${raceName}`,
        body: `Your entry fees are outstanding. Birds with unpaid fees do not receive a position in the final race.`,
        link: eventId != null ? `/events/${eventId}` : "/payments",
        seasonId,
        raceId,
      }))
  );
}

/** Defaulter birds have been listed in the event store. */
export async function notifyStoreListing(
  seasonId: number,
  birdCount: number,
  eventId: number | null
): Promise<number> {
  const userIds = await usersInSeason(seasonId);
  return notifySafely(
    userIds.map((userId) => ({
      userId,
      kind: "STORE_LISTING" as const,
      title: `${birdCount} bird${birdCount === 1 ? "" : "s"} listed in the event store`,
      body: `Defaulter birds are available to buy.`,
      link: eventId != null ? `/events/${eventId}` : null,
      seasonId,
    }))
  );
}
