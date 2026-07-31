import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type LocationStatus = "LOST" | "ARRIVED" | "BASKETED" | "HELD";

interface LocationResponse {
  status: LocationStatus;
  label: string;
  eventName?: string;
  raceName?: string;
  basketLabel?: string;
  phase?: "LOFT" | "RACE";
  since?: string;
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
      include: {
        breeder: { select: { id: true, userId: true, lastName: true } },
        lostRace: { include: { seasonRel: { include: { event: { select: { name: true } } } } } },
      },
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

    const loftName =
      (await prisma.user
        .findUnique({ where: { id: bird.breeder?.userId ?? "" }, select: { loftName: true, name: true } })
        .catch(() => null)) ?? null;
    const breederLabel =
      loftName?.loftName || loftName?.name || bird.breeder?.lastName || "Breeder";

    if (bird.isLost === 1 && bird.lostRaceId) {
      const res: LocationResponse = {
        status: "LOST",
        label: `Lost at ${bird.lostRace?.location ?? bird.lostRace?.name ?? "race"}`,
        raceName: bird.lostRace?.name ?? undefined,
        eventName: bird.lostRace?.seasonRel?.event?.name ?? undefined,
        since: bird.lostDate?.toISOString(),
      };
      return NextResponse.json(res);
    }

    const arrived = await prisma.raceItem.findFirst({
      where: {
        status: "ARRIVED",
        inventoryItem: { birdId: birdIdInt },
        result: { arrivalTime: { not: null } },
      },
      orderBy: { id: "desc" },
      include: {
        race: { include: { seasonRel: { include: { event: { select: { name: true } } } } } },
        result: true,
      },
    });

    if (arrived?.race) {
      const res: LocationResponse = {
        status: "ARRIVED",
        label: `Arrived at ${arrived.race.name || arrived.race.location || "race"}`,
        raceName: arrived.race.name ?? undefined,
        eventName: arrived.race.seasonRel?.event?.name ?? undefined,
        since: arrived.result?.arrivalTime?.toISOString(),
      };
      return NextResponse.json(res);
    }

    const assignment = await prisma.basketAssignment.findFirst({
      where: {
        inventoryItem: {
          birdId: birdIdInt,
        },
      },
      orderBy: { assignedAt: "desc" },
      include: {
        eventBasket: { include: { season: { include: { event: { select: { name: true } } } } } },
      },
    });

    if (assignment?.eventBasket) {
      const res: LocationResponse = {
        status: "BASKETED",
        label: assignment.eventBasket.label ?? `Basket #${assignment.eventBasket.basketNo}`,
        basketLabel: assignment.eventBasket.label ?? undefined,
        phase: assignment.eventBasket.phase,
        eventName: assignment.eventBasket.season?.event?.name ?? undefined,
        since: assignment.assignedAt.toISOString(),
      };
      return NextResponse.json(res);
    }

    const res: LocationResponse = {
      status: "HELD",
      label: `Held by ${breederLabel}`,
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error("Error fetching bird location:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
