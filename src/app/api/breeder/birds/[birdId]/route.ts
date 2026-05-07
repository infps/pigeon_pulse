import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const updateBirdSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  sex: z.number().int().min(0).max(2).optional(),
  band1: z.string().min(1).optional(),
  band2: z.string().min(1).optional(),
  band3: z.string().min(1).optional(),
  band4: z.string().min(1).optional(),
  fatherId: z.number().int().nullable().optional(),
  motherId: z.number().int().nullable().optional(),
  isPublic: z.number().int().min(0).max(1).optional(),
  note: z.string().nullable().optional(),
  rfid: z.string().nullable().optional(),
  attention: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const { birdId } = await params;
    const birdIdInt = parseInt(birdId);

    const bird = await prisma.bird.findUnique({
      where: { id: birdIdInt },
      include: {
        breeder: { select: { id: true, firstName: true, lastName: true } },
        father: true,
        mother: true,
        childrenAsFather: true,
        childrenAsMother: true,
      },
    });

    if (!bird) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }

    // Check access: admin/superadmin (any), owner, or public
    let isOwner = false;
    const isAdmin =
      !!session?.user &&
      ["ADMIN", "SUPERADMIN"].includes(session.user.role);
    if (session?.user && !isAdmin) {
      const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
      isOwner = bird.breederId === breeder.id;
    }

    if (!isAdmin && !isOwner && bird.isPublic !== 1) {
      return NextResponse.json({ message: "Bird is private" }, { status: 403 });
    }

    // Fetch siblings (same father OR mother, exclude self)
    let siblings: any[] = [];
    const parentConditions = [];
    if (bird.fatherId) parentConditions.push({ fatherId: bird.fatherId });
    if (bird.motherId) parentConditions.push({ motherId: bird.motherId });

    if (parentConditions.length > 0) {
      siblings = await prisma.bird.findMany({
        where: {
          OR: parentConditions,
          NOT: { id: birdIdInt },
        },
      });
    }

    return NextResponse.json({
      bird: { ...bird, siblings },
      isOwner,
      message: "Bird fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching bird:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const birdIdInt = parseInt(birdId);

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

    const existingBird = await prisma.bird.findUnique({
      where: { id: birdIdInt },
    });

    if (!existingBird) {
      return NextResponse.json(
        { message: "Bird not found" },
        { status: 404 }
      );
    }

    if (existingBird.breederId !== breeder.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateBirdSchema.parse(body);

    const band1 = validatedData.band1 ?? existingBird.band1;
    const band2 = validatedData.band2 ?? existingBird.band2;
    const band3 = validatedData.band3 ?? existingBird.band3;
    const band4 = validatedData.band4 ?? existingBird.band4;
    const bandChanged =
      validatedData.band1 ||
      validatedData.band2 ||
      validatedData.band3 ||
      validatedData.band4;

    const bird = await prisma.bird.update({
      where: { id: birdIdInt },
      data: {
        ...(validatedData.name && { birdName: validatedData.name }),
        ...(validatedData.color && { color: validatedData.color }),
        ...(validatedData.sex !== undefined && { sex: validatedData.sex }),
        ...(validatedData.band1 && { band1: validatedData.band1 }),
        ...(validatedData.band2 && { band2: validatedData.band2 }),
        ...(validatedData.band3 && { band3: validatedData.band3 }),
        ...(validatedData.band4 && { band4: validatedData.band4 }),
        ...(bandChanged && { band: `${band1}-${band2}-${band3}-${band4}` }),
        ...(validatedData.fatherId !== undefined && { fatherId: validatedData.fatherId }),
        ...(validatedData.motherId !== undefined && { motherId: validatedData.motherId }),
        ...(validatedData.isPublic !== undefined && { isPublic: validatedData.isPublic }),
        ...(validatedData.note !== undefined && { note: validatedData.note }),
        ...(validatedData.rfid !== undefined && { rfid: validatedData.rfid }),
        ...(validatedData.attention !== undefined && { attention: validatedData.attention }),
      },
    });

    return NextResponse.json(
      { bird, message: "Bird updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating bird:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
