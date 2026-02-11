import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const createBirdSchema = z.object({
  name: z.string().min(1, "Bird name is required"),
  color: z.string().min(1, "Color is required"),
  sex: z.enum(["COCK", "HEN", "UNKNOWN"]),
  band1: z.string().min(1, "Band1 is required"),
  band2: z.string().min(1, "Band2 is required"),
  band3: z.string().min(1, "Band3 is required"),
  band4: z.string().min(1, "Band4 is required"),
});

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const birds = await prisma.bird.findMany({
      where: { breederId: session.user.id },
      orderBy: { birdName: "asc" },
    });

    return NextResponse.json(
      { birds, message: "Birds fetched successfully" },
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
    if (!session || !session.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
        breederId: session.user.id,
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
