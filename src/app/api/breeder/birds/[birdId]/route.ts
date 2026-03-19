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
});

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
