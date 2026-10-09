import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { activeItem } from "@/lib/entry-filters";
import { prisma } from "@/lib/prisma";
import { notifyRaceStarted } from "@/lib/notifications";
import { presetIdFor } from "@/lib/birdStatus";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);

    const body = await request.json().catch(() => ({}));
    const basketIds: number[] | undefined =
      Array.isArray(body?.basketIds) && body.basketIds.length > 0
        ? body.basketIds.map(Number)
        : undefined;

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    if (race.status !== "REGISTERING") {
      return NextResponse.json(
        { message: "Race already started" },
        { status: 400 }
      );
    }

    // Released birds get the "Flying" configurable status (trigger RELEASE).
    const flyingId = await presetIdFor(race.seasonId, "RELEASE");

    // If specific baskets selected, scope release to those basket assignments only.
    let inventoryItemIds: number[] | undefined;
    if (basketIds) {
      const assignments = await prisma.basketAssignment.findMany({
        where: { eventBasketId: { in: basketIds }, inventoryItem: activeItem },
        select: { eventInventoryItemId: true },
      });
      inventoryItemIds = assignments.map((a) => a.eventInventoryItemId);
    }

    // Start race + release basketted birds (all or scoped to selected baskets)
    const [updatedRace] = await prisma.$transaction([
      prisma.race.update({
        where: { id: raceIdInt },
        data: { startTime: new Date(), status: "STARTED" },
        include: {
          raceType: true,
          seasonRel: { include: { event: { select: { id: true, name: true, shortName: true } } } },
        },
      }),
      prisma.raceItem.updateMany({
        where: {
          raceId: raceIdInt,
          status: { in: ["LOFT_BASKETED"] },
          OR: [{ inventoryItemId: null }, { inventoryItem: activeItem }],
          ...(inventoryItemIds ? { inventoryItemId: { in: inventoryItemIds } } : undefined),
        },
        data: { status: "RELEASED", displayStatusId: flyingId },
      }),
    ]);

    // Write RELEASED history for all birds now in the race
    const releasedItems = await prisma.raceItem.findMany({
      where: { raceId: raceIdInt, status: "RELEASED" },
      select: { inventoryItemId: true },
    });
    await prisma.birdEventHistory.createMany({
      data: releasedItems
        .filter((i) => i.inventoryItemId !== null)
        .map((i) => ({
          eventInventoryItemId: i.inventoryItemId!,
          action: "RELEASED" as const,
          detail: `Released for race ${raceId}`,
          performedById: session?.user?.id ?? null,
        })),
      skipDuplicates: true,
    });

    // Everyone with a bird in the air hears about it. Fire-and-forget: a
    // failed announcement must not stop the race from starting.
    const notified = await notifyRaceStarted(raceIdInt);

    return NextResponse.json(
      { race: updatedRace, notified, message: "Race started successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error starting race:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
