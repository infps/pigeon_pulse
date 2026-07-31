import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type HistoryType =
  | "REGISTERED"
  | "BASKETED"
  | "RELEASED"
  | "ARRIVED"
  | "FOREIGN_BIRD"
  | "LOST";

interface HistoryEntry {
  type: HistoryType;
  date: string;
  eventId?: number;
  eventName?: string;
  raceId?: number;
  raceName?: string;
  basketLabel?: string;
  phase?: "LOFT" | "RACE";
  position?: number;
  prizeValue?: number;
  // enriched fields
  distance?: number;
  ypm?: number;
  gapMs?: number;
  raceTypeName?: string | null;
  startTime?: string;
  flightTimeMs?: number;
  eventBanner?: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const { birdId } = await params;
    const birdIdInt = parseInt(birdId);
    if (Number.isNaN(birdIdInt)) {
      return NextResponse.json({ message: "Invalid birdId" }, { status: 400 });
    }

    const bird = await prisma.bird.findUnique({
      where: { id: birdIdInt },
      include: {
        breeder: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            user: { select: { loftName: true, image: true } },
          },
        },
      },
    });
    if (!bird) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }

    const inventoryItems = await prisma.eventInventoryItem.findMany({
      where: { birdId: birdIdInt },
      include: {
        eventInventory: {
          include: {
            season: {
              include: {
                event: {
                  select: { id: true, name: true, bannerImage: true, logoImage: true },
                },
              },
            },
          },
        },
        raceItems: {
          include: {
            race: {
              select: {
                id: true,
                name: true,
                startTime: true,
                seasonId: true,
                distance: true,
                raceType: { select: { name: true } },
              },
            },
            result: true,
          },
        },
        basketAssignments: {
          include: {
            eventBasket: {
              include: { season: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    // Batch-fetch leader (first arrival) per race for gap computation
    const arrivedRaceIds = new Set<number>();
    for (const inv of inventoryItems) {
      for (const ri of inv.raceItems) {
        if (ri.status === "ARRIVED" && ri.race?.id && ri.result?.arrivalTime) {
          arrivedRaceIds.add(ri.race.id);
        }
      }
    }

    const leaderTimesMap = new Map<number, number>(); // raceId -> earliest arrival ms
    if (arrivedRaceIds.size > 0) {
      const allArrivals = await prisma.raceItem.findMany({
        where: { raceId: { in: [...arrivedRaceIds] }, status: "ARRIVED" },
        include: { result: { select: { arrivalTime: true } } },
      });
      for (const ri of allArrivals) {
        const t = ri.result?.arrivalTime;
        if (ri.raceId && t) {
          const ms = new Date(t).getTime();
          const existing = leaderTimesMap.get(ri.raceId);
          if (existing === undefined || ms < existing) {
            leaderTimesMap.set(ri.raceId, ms);
          }
        }
      }
    }

    const lostHistory = await prisma.lostHistory.findMany({
      where: { birdId: birdIdInt },
      include: { race: { select: { id: true, name: true } } },
    });

    const entries: HistoryEntry[] = [];

    for (const inv of inventoryItems) {
      const ev = inv.eventInventory?.season?.event;
      const eventBanner = ev?.bannerImage ?? ev?.logoImage ?? null;
      const signIn = inv.eventInventory?.signInDate ?? inv.arrivalDate;
      if (signIn && ev) {
        entries.push({
          type: "REGISTERED",
          date: signIn.toISOString(),
          eventId: ev.id,
          eventName: ev.name ?? undefined,
        });
      }

      for (const ri of inv.raceItems) {
        if (!ri.race) continue;
        const raceTypeName = ri.race.raceType?.name ?? null;

        if (ri.status === "RELEASED") {
          if (ri.race.startTime) {
            entries.push({
              type: "RELEASED",
              date: ri.race.startTime.toISOString(),
              eventId: ri.race.seasonId ?? undefined,
              eventName: ev?.name ?? undefined,
              raceId: ri.race.id,
              raceName: ri.race.name ?? undefined,
              raceTypeName,
            });
          }
        } else if (ri.status === "ARRIVED") {
          const t = ri.result?.arrivalTime ?? ri.race.startTime;
          if (t) {
            const arrivalMs = new Date(t).getTime();
            const startMs = ri.race.startTime
              ? new Date(ri.race.startTime).getTime()
              : null;
            const distanceMi = ri.race.distance ?? 0;
            const distanceYards = distanceMi * 1760;
            let ypm: number | undefined;
            let flightTimeMs: number | undefined;
            if (startMs) {
              flightTimeMs = arrivalMs - startMs;
              if (distanceYards > 0 && flightTimeMs > 0) {
                ypm = distanceYards / (flightTimeMs / 60000);
              }
            }
            const leaderMs = leaderTimesMap.get(ri.race.id);
            const gapMs =
              leaderMs !== undefined ? arrivalMs - leaderMs : undefined;

            entries.push({
              type: "ARRIVED",
              date: t.toISOString(),
              eventId: ri.race.seasonId ?? undefined,
              eventName: ev?.name ?? undefined,
              raceId: ri.race.id,
              raceName: ri.race.name ?? undefined,
              position: ri.result?.birdPosition ?? undefined,
              prizeValue: ri.result?.prizeValue ?? undefined,
              distance: distanceMi > 0 ? distanceMi : undefined,
              ypm,
              gapMs,
              raceTypeName,
              startTime: ri.race.startTime?.toISOString(),
              flightTimeMs,
              eventBanner,
            });
          }
        } else if (ri.status === "FOREIGN_BIRD") {
          const t = ri.race.startTime;
          if (t) {
            entries.push({
              type: "FOREIGN_BIRD",
              date: t.toISOString(),
              eventId: ri.race.seasonId ?? undefined,
              eventName: ev?.name ?? undefined,
              raceId: ri.race.id,
              raceName: ri.race.name ?? undefined,
              raceTypeName,
            });
          }
        }
      }

      for (const ba of inv.basketAssignments) {
        entries.push({
          type: "BASKETED",
          date: ba.assignedAt.toISOString(),
          eventId: ba.eventBasket.season?.id,
          eventName: ba.eventBasket.season?.name ?? undefined,
          basketLabel:
            ba.eventBasket.label ?? `Basket #${ba.eventBasket.basketNo}`,
          phase: ba.eventBasket.phase,
        });
      }
    }

    for (const lh of lostHistory) {
      if (!lh.lostDate) continue;
      entries.push({
        type: "LOST",
        date: lh.lostDate.toISOString(),
        raceId: lh.race?.id,
        raceName: lh.race?.name ?? undefined,
      });
    }

    entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const breeder = bird.breeder;
    const loftName =
      breeder?.user?.loftName ||
      `${breeder?.firstName ?? ""} ${breeder?.lastName ?? ""}`.trim() ||
      "Unknown";
    const loftImage = breeder?.user?.image ?? null;
    const bandParts = [bird.band1, bird.band2, bird.band3, bird.band4].filter(
      Boolean
    );

    const birdInfo = {
      band: bandParts.join("-"),
      loftName,
      breederName: breeder
        ? `${breeder.firstName ?? ""} ${breeder.lastName ?? ""}`.trim()
        : "",
      loftImage,
      eligible: bird.isActive === 1,
    };

    return NextResponse.json({ entries, birdInfo });
  } catch (error) {
    console.error("Error fetching bird history:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
