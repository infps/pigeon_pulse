import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const updateBirdSchema = z.object({
  band1: z.string().min(1).optional(),
  band2: z.string().min(1).optional(),
  band3: z.string().min(1).optional(),
  band4: z.string().min(1).optional(),
  band: z.string().nullable().optional(),
  birdName: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sex: z.coerce.number().int().min(0).max(2).optional(),
  rfid: z.string().nullable().optional(),
  isActive: z.coerce.number().int().min(0).max(1).optional(),
  isLost: z.coerce.number().int().min(0).max(1).optional(),
  lostDate: z
    .union([z.string(), z.date(), z.null()])
    .optional()
    .transform((v) => (v == null ? v : v instanceof Date ? v : new Date(v))),
  lostRaceId: z.coerce.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  isPublic: z.coerce.number().int().min(0).max(1).optional(),
  attention: z.coerce.boolean().optional(),
});

type UpdateBirdInput = z.infer<typeof updateBirdSchema>;

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (
    !session ||
    !session.user ||
    !["ADMIN", "SUPERADMIN"].includes(session.user.role)
  ) {
    return null;
  }
  return session;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const id = parseInt(birdId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "Invalid birdId" }, { status: 400 });
    }

    const bird = await prisma.bird.findUnique({
      where: { id },
      include: {
        breeder: true,
        picture: true,
        inventoryItems: {
          include: {
            eventInventory: { include: { event: true, breeder: true } },
            raceItems: { include: { race: true, result: true } },
            basketAssignments: {
              include: {
                eventBasket: { include: { event: true, race: true } },
              },
            },
          },
        },
        lostHistory: { include: { race: true } },
        lostRace: true,
        father: true,
        mother: true,
      },
    });

    if (!bird) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }

    return NextResponse.json({ bird });
  } catch (error) {
    console.error("Error fetching bird (admin):", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const id = parseInt(birdId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "Invalid birdId" }, { status: 400 });
    }

    const existing = await prisma.bird.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: UpdateBirdInput = updateBirdSchema.parse(body);

    const band1 = data.band1 ?? existing.band1;
    const band2 = data.band2 ?? existing.band2;
    const band3 = data.band3 ?? existing.band3;
    const band4 = data.band4 ?? existing.band4;
    const bandChanged =
      data.band1 !== undefined ||
      data.band2 !== undefined ||
      data.band3 !== undefined ||
      data.band4 !== undefined;

    const bird = await prisma.bird.update({
      where: { id },
      data: {
        ...(data.band1 !== undefined && { band1: data.band1 }),
        ...(data.band2 !== undefined && { band2: data.band2 }),
        ...(data.band3 !== undefined && { band3: data.band3 }),
        ...(data.band4 !== undefined && { band4: data.band4 }),
        ...(data.band !== undefined
          ? { band: data.band }
          : bandChanged
          ? { band: `${band1 ?? ""}-${band2 ?? ""}-${band3 ?? ""}-${band4 ?? ""}` }
          : {}),
        ...(data.birdName !== undefined && { birdName: data.birdName }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.sex !== undefined && { sex: data.sex }),
        ...(data.rfid !== undefined && { rfid: data.rfid }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isLost !== undefined && { isLost: data.isLost }),
        ...(data.lostDate !== undefined && { lostDate: data.lostDate ?? null }),
        ...(data.lostRaceId !== undefined && { lostRaceId: data.lostRaceId }),
        ...(data.note !== undefined && { note: data.note }),
        ...(data.image !== undefined && { image: data.image }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(data.attention !== undefined && { attention: data.attention }),
      },
    });

    return NextResponse.json({ bird });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating bird (admin):", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const id = parseInt(birdId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "Invalid birdId" }, { status: 400 });
    }

    const existing = await prisma.bird.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }

    const bird = await prisma.$transaction(async (tx) => {
      const inventoryItems = await tx.eventInventoryItem.findMany({
        where: { birdId: id },
        select: { id: true },
      });
      const inventoryItemIds = inventoryItems.map((i) => i.id);

      if (inventoryItemIds.length > 0) {
        const raceItems = await tx.raceItem.findMany({
          where: { inventoryItemId: { in: inventoryItemIds } },
          select: { id: true },
        });
        const raceItemIds = raceItems.map((r) => r.id);

        if (raceItemIds.length > 0) {
          await tx.raceItemResult.deleteMany({
            where: { raceItemId: { in: raceItemIds } },
          });
          await tx.raceItemScan.deleteMany({
            where: { raceItemId: { in: raceItemIds } },
          });
          await tx.raceItem.deleteMany({
            where: { id: { in: raceItemIds } },
          });
        }

        await tx.basketAssignment.deleteMany({
          where: { eventInventoryItemId: { in: inventoryItemIds } },
        });
        await tx.eventInventoryItem.deleteMany({
          where: { id: { in: inventoryItemIds } },
        });
      }

      await tx.lostHistory.deleteMany({ where: { birdId: id } });
      await tx.rfidScan.deleteMany({ where: { birdId: id } });
      await tx.racePhantomBird.deleteMany({ where: { birdId: id } });

      const deleted = await tx.bird.delete({ where: { id } });
      return deleted;
    });

    return NextResponse.json({ bird });
  } catch (error) {
    console.error("Error deleting bird (admin):", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
