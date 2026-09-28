import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  notifyRaceUpcoming,
  notifyBetPrompt,
  notifyPaymentRisk,
} from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in20h = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const in28h = new Date(now.getTime() + 28 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Races starting tomorrow (20-28h window)
  const tomorrowRaces = await prisma.race.findMany({
    where: {
      startTime: { gte: in20h, lte: in28h },
      status: { notIn: ["STARTED", "ENDED"] },
    },
    select: {
      id: true,
      name: true,
      raceNumber: true,
      seasonId: true,
      bettingOpen: true,
      seasonRel: { select: { eventId: true } },
    },
  });

  // Step A: race reminders
  for (const race of tomorrowRaces) {
    try {
      await notifyRaceUpcoming(race.id);
    } catch (e) {
      console.error(`[cron] notifyRaceUpcoming failed for race ${race.id}:`, e);
    }
  }

  // Step B: bet prompts for tomorrow's races with betting open
  for (const race of tomorrowRaces.filter((r) => r.bettingOpen)) {
    try {
      // Get all enrolled users
      const enrolled = await prisma.raceItem.findMany({
        where: { raceId: race.id },
        select: {
          inventoryItem: {
            select: { eventInventory: { select: { breeder: { select: { userId: true } } } } },
          },
        },
      });
      const enrolledUserIds = new Set(
        enrolled
          .map((r) => r.inventoryItem?.eventInventory?.breeder?.userId)
          .filter((id): id is string => id != null)
      );

      // Who has already bet on this race
      const bettors = await prisma.bet.findMany({
        where: { raceId: race.id },
        select: { ownerUserId: true },
        distinct: ["ownerUserId"],
      });
      const bettorIds = new Set(bettors.map((b) => b.ownerUserId).filter((id): id is string => id != null));

      const unbettedUserIds = [...enrolledUserIds].filter((id) => !bettorIds.has(id));
      await notifyBetPrompt(race.id, unbettedUserIds);
    } catch (e) {
      console.error(`[cron] notifyBetPrompt failed for race ${race.id}:`, e);
    }
  }

  // Step C: payment risk — breeders with PENDING/PARTIAL payments in seasons
  // that have races in the next 7 days
  const upcomingRaces = await prisma.race.findMany({
    where: {
      startTime: { gte: now, lte: in7d },
      status: { notIn: ["STARTED", "ENDED"] },
      seasonId: { not: null },
    },
    select: { id: true, seasonId: true, name: true, raceNumber: true, seasonRel: { select: { eventId: true } } },
  });

  const seasonIds = [...new Set(upcomingRaces.map((r) => r.seasonId).filter((id): id is number => id != null))];

  if (seasonIds.length > 0) {
    const unpaidInventories = await prisma.eventInventory.findMany({
      where: {
        seasonId: { in: seasonIds },
        payments: { some: { status: { in: ["PENDING", "PARTIAL"] } } },
      },
      select: {
        breederId: true,
        seasonId: true,
        season: { select: { eventId: true } },
      },
    });

    // Group by seasonId
    const bySeasonId = new Map<number, { breederIds: number[]; eventId: number | null }>();
    for (const inv of unpaidInventories) {
      if (!inv.seasonId || !inv.breederId) continue;
      const entry = bySeasonId.get(inv.seasonId) ?? { breederIds: [], eventId: inv.season?.eventId ?? null };
      entry.breederIds.push(inv.breederId);
      bySeasonId.set(inv.seasonId, entry);
    }

    for (const race of upcomingRaces) {
      if (!race.seasonId) continue;
      const entry = bySeasonId.get(race.seasonId);
      if (!entry || entry.breederIds.length === 0) continue;
      const raceName = race.name || (race.raceNumber != null ? `Race ${race.raceNumber}` : "an upcoming race");
      try {
        await notifyPaymentRisk(entry.breederIds, race.seasonId, race.id, raceName, entry.eventId ?? null);
      } catch (e) {
        console.error(`[cron] notifyPaymentRisk failed for race ${race.id}:`, e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
