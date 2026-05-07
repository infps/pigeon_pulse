import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
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
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const birdIdInt = parseInt(birdId);
    if (Number.isNaN(birdIdInt)) {
      return NextResponse.json({ message: "Invalid birdId" }, { status: 400 });
    }

    const bird = await prisma.bird.findUnique({
      where: { id: birdIdInt },
      include: { breeder: { select: { userId: true } } },
    });
    if (!bird) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }

    const role = session.user.role;
    const isPrivileged = role === "ADMIN" || role === "SUPERADMIN";
    const isOwner = bird.breeder?.userId === session.user.id;
    if (!isPrivileged && !isOwner) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const inventoryItems = await prisma.eventInventoryItem.findMany({
      where: { birdId: birdIdInt },
      include: {
        eventInventory: {
          include: { event: { select: { id: true, name: true } } },
        },
        raceItems: {
          include: {
            race: { select: { id: true, name: true, startTime: true, eventId: true } },
            result: true,
          },
        },
        basketAssignments: {
          include: {
            eventBasket: {
              include: { event: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    const lostHistory = await prisma.lostHistory.findMany({
      where: { birdId: birdIdInt },
      include: { race: { select: { id: true, name: true } } },
    });

    const entries: HistoryEntry[] = [];

    for (const inv of inventoryItems) {
      const ev = inv.eventInventory?.event;
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
        if (ri.status === "RELEASED") {
          if (ri.race.startTime) {
            entries.push({
              type: "RELEASED",
              date: ri.race.startTime.toISOString(),
              eventId: ri.race.eventId ?? undefined,
              eventName: ev?.name ?? undefined,
              raceId: ri.race.id,
              raceName: ri.race.name,
            });
          }
        } else if (ri.status === "ARRIVED") {
          const t = ri.result?.arrivalTime ?? ri.race.startTime;
          if (t) {
            entries.push({
              type: "ARRIVED",
              date: t.toISOString(),
              eventId: ri.race.eventId ?? undefined,
              eventName: ev?.name ?? undefined,
              raceId: ri.race.id,
              raceName: ri.race.name,
              position: ri.result?.birdPosition ?? undefined,
              prizeValue: ri.result?.prizeValue ?? undefined,
            });
          }
        } else if (ri.status === "FOREIGN_BIRD") {
          const t = ri.race.startTime;
          if (t) {
            entries.push({
              type: "FOREIGN_BIRD",
              date: t.toISOString(),
              eventId: ri.race.eventId ?? undefined,
              eventName: ev?.name ?? undefined,
              raceId: ri.race.id,
              raceName: ri.race.name,
            });
          }
        }
      }

      for (const ba of inv.basketAssignments) {
        entries.push({
          type: "BASKETED",
          date: ba.assignedAt.toISOString(),
          eventId: ba.eventBasket.event?.id,
          eventName: ba.eventBasket.event?.name ?? undefined,
          basketLabel: ba.eventBasket.label ?? `Basket #${ba.eventBasket.basketNo}`,
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

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching bird history:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
