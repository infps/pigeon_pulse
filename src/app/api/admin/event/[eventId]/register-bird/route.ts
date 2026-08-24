import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  breederId: z.number().int().positive(),
  name: z.string().min(1),
  band1: z.string().min(1),
  band2: z.string().min(1),
  band3: z.string().min(1),
  band4: z.string().min(1),
  color: z.string().min(1),
  sex: z.number().int().min(0).max(2),
  rfid: z.string().optional(),
  attention: z.boolean().optional(),
  isBackup: z.boolean().optional(),
});

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

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    const { breederId, name, band1, band2, band3, band4, color, sex, rfid, attention, isBackup } = parsed.data;

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

    const breeder = await prisma.breeder.findUnique({ where: { id: breederId } });
    if (!breeder) {
      return NextResponse.json({ message: "Breeder not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const bird = await tx.bird.create({
        data: {
          birdName: name,
          band: `${band1}-${band2}-${band3}-${band4}`,
          band1, band2, band3, band4,
          color,
          sex,
          rfid: rfid || null,
          attention: attention ?? false,
          breederId,
          isActive: 1,
          isLost: 0,
        },
      });

      const races = await tx.race.findMany({
        where: { seasonId },
        select: { id: true },
      });

      let eventInventory = await tx.eventInventory.findFirst({
        where: { seasonId, breederId },
      });
      if (!eventInventory) {
        const loftName = breeder.lastName || breeder.firstName || "Default";
        eventInventory = await tx.eventInventory.create({
          data: { seasonId, breederId, loft: loftName, reservedBirds: 0 },
        });
      }

      const item = await tx.eventInventoryItem.create({
        data: { birdId: bird.id, eventInventoryId: eventInventory.id, isBackup: isBackup ? 1 : 0 },
      });

      await tx.eventInventory.update({
        where: { id: eventInventory.id },
        data: { reservedBirds: { increment: 1 } },
      });

      if (races.length > 0) {
        await tx.raceItem.createMany({
          data: races.map((race) => ({ raceId: race.id, inventoryItemId: item.id })),
        });
      }

      return { bird, itemId: item.id };
    });

    return NextResponse.json({ bird: result.bird, message: "Bird registered and added to event" }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ message: "A bird with this band already exists" }, { status: 409 });
    }
    console.error("Error registering bird:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
