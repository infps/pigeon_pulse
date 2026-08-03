import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const createBirdSchema = z.object({
  name: z.string().min(1, "Bird name is required"),
  color: z.string().min(1, "Color is required"),
  sex: z.number().int().min(0).max(2),
  band1: z.string().min(1, "Band1 is required"),
  band2: z.string().min(1, "Band2 is required"),
  band3: z.string().min(1, "Band3 is required"),
  band4: z.string().min(1, "Band4 is required"),
  rfid: z.string().optional(),
  attention: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

    const birds = await prisma.bird.findMany({
      where: { breederId: breeder.id },
      orderBy: { birdName: "asc" },
      include: {
        inventoryItems: {
          include: {
            raceItems: {
              select: { status: true, result: { select: { birdPosition: true } } },
            },
          },
        },
      },
    });

    const enriched = birds.map((bird) => {
      const raceItems = bird.inventoryItems.flatMap((i: any) => i.raceItems);
      const arrived = raceItems.filter((r: any) => r.status === "ARRIVED");
      const positions = arrived.map((r: any) => r.result?.birdPosition).filter((p: any): p is number => p != null);
      const activeStatuses = ["LOFT_BASKETED", "RELEASED", "ARRIVED", "FOREIGN_BIRD"];
      const currentStatus = raceItems.find((r: any) => activeStatuses.includes(r.status))?.status ?? null;
      const { inventoryItems: _drop, ...rest } = bird;
      return {
        ...rest,
        totalRaces: arrived.length,
        wins: positions.filter((p: number) => p === 1).length,
        bestPosition: positions.length > 0 ? Math.min(...positions) : null,
        currentStatus,
      };
    });

    return NextResponse.json(
      { birds: enriched, message: "Birds fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching birds:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const allowedRoles = ["BREEDER", "ADMIN", "SUPERADMIN"];
    if (!session || !session.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

    const body = await request.json();
    const validatedData = createBirdSchema.parse(body);

    const band = `${validatedData.band1}-${validatedData.band2}-${validatedData.band3}-${validatedData.band4}`;

    const bird = await prisma.bird.create({
      data: {
        band,
        band1: validatedData.band1,
        band2: validatedData.band2,
        band3: validatedData.band3,
        band4: validatedData.band4,
        birdName: validatedData.name,
        color: validatedData.color,
        sex: validatedData.sex,
        rfid: validatedData.rfid || null,
        breederId: breeder.id,
        isActive: 1,
        isLost: 0,
        attention: validatedData.attention ?? false,
      },
    });

    return NextResponse.json(
      { bird, message: "Bird created successfully" },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "A bird with this band already exists" },
        { status: 409 }
      );
    }
    console.error("Error creating bird:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
