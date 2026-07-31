import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const seasonIdParam = url.searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = activeSeason.id;
    }

    const body = await request.json();
    const birdIds: number[] = body.birdIds;

    if (!Array.isArray(birdIds) || birdIds.length === 0) {
      return NextResponse.json({ message: "Non-empty birdIds array required" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ message: "Event not found" }, { status: 404 });
    }

    // Fetch birds with breeder info
    const birds = await prisma.bird.findMany({
      where: { id: { in: birdIds } },
      include: { breeder: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (birds.length === 0) {
      return NextResponse.json({ message: "No valid birds found" }, { status: 400 });
    }

    // Group birds by breeder
    const breederGroups = new Map<number, {
      breeder: { id: number; firstName: string | null; lastName: string | null };
      birdIds: number[];
    }>();
    for (const bird of birds) {
      if (!bird.breederId || !bird.breeder) continue;
      const group = breederGroups.get(bird.breederId);
      if (group) {
        group.birdIds.push(bird.id);
      } else {
        breederGroups.set(bird.breederId, { breeder: bird.breeder, birdIds: [bird.id] });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalAdded = 0;
      let totalSkipped = 0;

      const races = await tx.race.findMany({
        where: { seasonId },
        select: { id: true },
      });

      for (const [breederId, group] of breederGroups) {
        // Find or create EventInventory
        let eventInventory = await tx.eventInventory.findFirst({
          where: { seasonId, breederId },
        });

        if (!eventInventory) {
          const loftName = group.breeder.lastName || group.breeder.firstName || "Default";
          eventInventory = await tx.eventInventory.create({
            data: { seasonId, breederId, loft: loftName, reservedBirds: 0 },
          });
        }

        // Skip birds already in this registration
        const existingItems = await tx.eventInventoryItem.findMany({
          where: { eventInventoryId: eventInventory.id },
          select: { birdId: true },
        });
        const existingBirdIds = new Set(existingItems.map((i) => i.birdId));
        const newBirdIds = group.birdIds.filter((id) => !existingBirdIds.has(id));

        totalSkipped += group.birdIds.length - newBirdIds.length;
        if (newBirdIds.length === 0) continue;

        // Create EventInventoryItems
        const createdItems: { id: number }[] = [];
        for (const birdId of newBirdIds) {
          const item = await tx.eventInventoryItem.create({
            data: { birdId, eventInventoryId: eventInventory.id },
          });
          createdItems.push({ id: item.id });
        }

        await tx.eventInventory.update({
          where: { id: eventInventory.id },
          data: { reservedBirds: { increment: newBirdIds.length } },
        });

        // Create RaceItems for all season races
        if (races.length > 0) {
          const raceItemData = races.flatMap((race) =>
            createdItems.map((item) => ({ raceId: race.id, inventoryItemId: item.id }))
          );
          await tx.raceItem.createMany({ data: raceItemData });
        }

        totalAdded += newBirdIds.length;
      }

      // TODO: Fee integration — see docs/06-add-birds-fee-integration.md

      return { added: totalAdded, skipped: totalSkipped };
    });

    return NextResponse.json({
      message: `${result.added} bird(s) added${result.skipped > 0 ? `, ${result.skipped} skipped (already in event)` : ""}`,
      ...result,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding birds to event:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
