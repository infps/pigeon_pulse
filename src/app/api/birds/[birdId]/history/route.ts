import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { activeItem, activeRaceItemOr } from "@/lib/entry-filters";

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

// Statuses that mean the bird was actually released (IGNORED = didn't fly).
const FLOWN = ["RELEASED", "ARRIVED", "FOREIGN_BIRD", "STRAY", "LOST"] as const;
type FlownStatus = (typeof FLOWN)[number];

/** One row per race the bird was released in (arrived or not). */
interface Flight {
  raceId: number;
  eventId?: number;
  raceName?: string;
  raceTypeName: string | null;
  isTraining: boolean;
  date?: string; // release time
  miles?: number;
  status: FlownStatus;
  position?: number;
  fieldSize?: number;
  arrivalTime?: string;
  flightTimeMs?: number;
  ypm?: number;
  toWinMs?: number;
  prizeValue?: number;
}

const isTrainingType = (name: string | null) => {
  const n = (name ?? "").toUpperCase();
  return n === "T" || n.includes("TRAINING");
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
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
            id: true,
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
      where: { birdId: birdIdInt, ...activeItem },
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
                raceStation: { select: { miles: true } },
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
        breederHistory: { orderBy: { transferredAt: "desc" } },
      },
    });

    // Batch-fetch leader (first arrival) per race for gap computation
    const arrivedRaceIds = new Set<number>();
    const flownRaceIds = new Set<number>();
    for (const inv of inventoryItems) {
      for (const ri of inv.raceItems) {
        if (ri.race?.id && (FLOWN as readonly string[]).includes(ri.status)) {
          flownRaceIds.add(ri.race.id);
        }
        if (ri.status === "ARRIVED" && ri.race?.id && ri.result?.arrivalTime) {
          arrivedRaceIds.add(ri.race.id);
        }
      }
    }

    const leaderTimesMap = new Map<number, number>(); // raceId -> earliest arrival ms
    if (arrivedRaceIds.size > 0) {
      const allArrivals = await prisma.raceItem.findMany({
        where: {
          raceId: { in: [...arrivedRaceIds] },
          status: "ARRIVED",
          OR: activeRaceItemOr,
        },
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

    // Field size = birds released per race.
    const fieldSizeMap = new Map<number, number>();
    if (flownRaceIds.size > 0) {
      const counts = await prisma.raceItem.groupBy({
        by: ["raceId"],
        where: {
          raceId: { in: [...flownRaceIds] },
          status: { in: [...FLOWN] },
          OR: activeRaceItemOr,
        },
        _count: { _all: true },
      });
      for (const c of counts) {
        if (c.raceId != null) fieldSizeMap.set(c.raceId, c._count._all);
      }
    }

    const lostHistory = await prisma.lostHistory.findMany({
      where: { birdId: birdIdInt },
      include: { race: { select: { id: true, name: true } } },
    });

    const entries: HistoryEntry[] = [];
    const flights: Flight[] = [];
    const transfers: { fromBreederName: string; transferredAt: string; eventName?: string }[] = [];

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

      for (const t of inv.breederHistory) {
        transfers.push({
          fromBreederName: t.fromBreederName,
          transferredAt: t.transferredAt.toISOString(),
          eventName: ev?.name ?? undefined,
        });
      }

      for (const ri of inv.raceItems) {
        if (!ri.race) continue;
        const raceTypeName = ri.race.raceType?.name ?? null;
        const raceMiles = ri.race.raceStation?.miles ?? ri.race.distance ?? 0;

        if ((FLOWN as readonly string[]).includes(ri.status)) {
          const startMs = ri.race.startTime?.getTime() ?? null;
          const arrival = ri.status === "ARRIVED" ? ri.result?.arrivalTime ?? null : null;
          const flightTimeMs =
            arrival && startMs ? arrival.getTime() - startMs : undefined;
          const leaderMs = leaderTimesMap.get(ri.race.id);
          flights.push({
            raceId: ri.race.id,
            eventId: ev?.id,
            raceName: ri.race.name ?? undefined,
            raceTypeName,
            isTraining: isTrainingType(raceTypeName),
            date: ri.race.startTime?.toISOString(),
            miles: raceMiles > 0 ? raceMiles : undefined,
            status: ri.status as FlownStatus,
            position: ri.status === "ARRIVED" ? ri.result?.birdPosition ?? undefined : undefined,
            fieldSize: fieldSizeMap.get(ri.race.id),
            arrivalTime: arrival?.toISOString(),
            flightTimeMs,
            ypm:
              flightTimeMs && flightTimeMs > 0 && raceMiles > 0
                ? (raceMiles * 1760) / (flightTimeMs / 60000)
                : undefined,
            toWinMs:
              arrival && leaderMs !== undefined ? arrival.getTime() - leaderMs : undefined,
            prizeValue: ri.result?.prizeValue ?? undefined,
          });
        }

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
            const distanceMi = raceMiles;
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
    flights.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    transfers.sort((a, b) => b.transferredAt.localeCompare(a.transferredAt));
    const prizeTotal = flights.reduce((s, f) => s + (f.prizeValue ?? 0), 0);

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
      breederId: breeder?.id ?? null,
      color: bird.color ?? null,
      sex: bird.sex ?? null,
      birdName: bird.birdName ?? null,
    };

    return NextResponse.json({ entries, birdInfo, flights, transfers, prizeTotal });
  } catch (error) {
    console.error("Error fetching bird history:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
