import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const birdSchema = z.object({
  name: z.string().min(1, "Bird name is required"),
  color: z.string().min(1, "Color is required"),
  sex: z.number().int().min(0).max(2),
  band1: z.string().min(1, "Band1 is required"),
  band2: z.string().min(1, "Band2 is required"),
  band3: z.string().min(1, "Band3 is required"),
  band4: z.string().min(1, "Band4 is required"),
  rfid: z.string().optional(),
});

const bulkCreateSchema = z.object({
  birds: z.array(birdSchema).min(1).max(50),
});

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
    const { birds: birdsData } = bulkCreateSchema.parse(body);

    const created: any[] = [];
    const errors: { index: number; band: string; message: string }[] = [];

    for (let i = 0; i < birdsData.length; i++) {
      const b = birdsData[i];
      const band = `${b.band1}-${b.band2}-${b.band3}-${b.band4}`;
      try {
        const bird = await prisma.bird.create({
          data: {
            band,
            band1: b.band1,
            band2: b.band2,
            band3: b.band3,
            band4: b.band4,
            birdName: b.name,
            color: b.color,
            sex: b.sex,
            rfid: b.rfid || null,
            breederId: breeder.id,
            isActive: 1,
            isLost: 0,
          },
        });
        created.push(bird);
      } catch (err: any) {
        const message = err?.code === "P2002"
          ? "Band already exists"
          : "Failed to create bird";
        errors.push({ index: i, band, message });
      }
    }

    return NextResponse.json(
      { created: created.length, failed: errors.length, birds: created, errors },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error bulk creating birds:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
