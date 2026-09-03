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
  // extended fields
  isActive: z.boolean().optional(),
  isLost: z.boolean().optional(),
  lostDate: z.string().optional().nullable(),
  lostRaceId: z.number().int().optional().nullable(),
  note: z.string().optional().nullable(),
  arrivalTime: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  // fees
  perchFeeValue: z.number().optional().nullable(),
  entryFeeValue: z.number().optional().nullable(),
  hotSpotFeeValue: z.number().optional().nullable(),
  raceFeeValue: z.number().optional().nullable(),
  // betting classes
  belgianShowBet1: z.number().optional().nullable(),
  belgianShowBet2: z.number().optional().nullable(),
  belgianShowBet3: z.number().optional().nullable(),
  belgianShowBet4: z.number().optional().nullable(),
  belgianShowBet5: z.number().optional().nullable(),
  belgianShowBet6: z.number().optional().nullable(),
  belgianShowBet7: z.number().optional().nullable(),
  standardShowBet1: z.number().optional().nullable(),
  standardShowBet2: z.number().optional().nullable(),
  standardShowBet3: z.number().optional().nullable(),
  standardShowBet4: z.number().optional().nullable(),
  standardShowBet5: z.number().optional().nullable(),
  wtaBet1: z.number().optional().nullable(),
  wtaBet2: z.number().optional().nullable(),
  wtaBet3: z.number().optional().nullable(),
  wtaBet4: z.number().optional().nullable(),
  wtaBet5: z.number().optional().nullable(),
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

    const {
      breederId, name, band1, band2, band3, band4, color, sex, rfid, attention, isBackup,
      isActive, isLost, lostDate, lostRaceId, note, arrivalTime, departureTime,
      perchFeeValue, entryFeeValue, hotSpotFeeValue, raceFeeValue,
      belgianShowBet1, belgianShowBet2, belgianShowBet3, belgianShowBet4,
      belgianShowBet5, belgianShowBet6, belgianShowBet7,
      standardShowBet1, standardShowBet2, standardShowBet3, standardShowBet4, standardShowBet5,
      wtaBet1, wtaBet2, wtaBet3, wtaBet4, wtaBet5,
    } = parsed.data;

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
          isActive: isActive === false ? 0 : 1,
          isLost: isLost ? 1 : 0,
          lostDate: lostDate ? new Date(lostDate) : null,
          lostRaceId: lostRaceId ?? null,
          note: note || null,
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
        data: {
          birdId: bird.id,
          eventInventoryId: eventInventory.id,
          isBackup: isBackup ? 1 : 0,
          arrivalDate: arrivalTime ? new Date(arrivalTime) : new Date(),
          departureDate: departureTime ? new Date(departureTime) : null,
          perchFeeValue: perchFeeValue ?? null,
          entryFeeValue: entryFeeValue ?? null,
          hotSpotFeeValue: hotSpotFeeValue ?? null,
          raceFeeValue: raceFeeValue ?? null,
          belgianShowBet1: belgianShowBet1 ?? null,
          belgianShowBet2: belgianShowBet2 ?? null,
          belgianShowBet3: belgianShowBet3 ?? null,
          belgianShowBet4: belgianShowBet4 ?? null,
          belgianShowBet5: belgianShowBet5 ?? null,
          belgianShowBet6: belgianShowBet6 ?? null,
          belgianShowBet7: belgianShowBet7 ?? null,
          standardShowBet1: standardShowBet1 ?? null,
          standardShowBet2: standardShowBet2 ?? null,
          standardShowBet3: standardShowBet3 ?? null,
          standardShowBet4: standardShowBet4 ?? null,
          standardShowBet5: standardShowBet5 ?? null,
          wtaBet1: wtaBet1 ?? null,
          wtaBet2: wtaBet2 ?? null,
          wtaBet3: wtaBet3 ?? null,
          wtaBet4: wtaBet4 ?? null,
          wtaBet5: wtaBet5 ?? null,
        },
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
