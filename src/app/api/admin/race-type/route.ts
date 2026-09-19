import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { createRaceTypeSchema } from "@/lib/zod";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

export async function GET() {
  try {
    const raceTypes = await prisma.raceType.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(
      { raceTypes, message: "Race types fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching race types:", error);
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
    const guard = await requirePermission("schemes.manage");
    if ("error" in guard) return guard.error;
    if (!session || !session.user.role || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const validatedData = createRaceTypeSchema.parse(body);
    const newRaceType = await prisma.raceType.create({
      data: {
        name: validatedData.name,
        color: validatedData.color ?? null,
        isPaymentRequired: validatedData.isPaymentRequired ?? false,
        prizeRole: validatedData.prizeRole ?? "NONE",
      },
    });
    return NextResponse.json(
      { message: "Race type created successfully", raceType: newRaceType },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating race type:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const guard2 = await requirePermission("schemes.manage");
    if ("error" in guard2) return guard2.error;
    if (!session || !session.user.role || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Race type ID is required" },
        { status: 400 }
      );
    }

    const validatedData = createRaceTypeSchema.parse(updateData);

    const updatedRaceType = await prisma.raceType.update({
      where: { id: parseInt(id) },
      data: {
        name: validatedData.name,
        color: validatedData.color ?? null,
        isPaymentRequired: validatedData.isPaymentRequired ?? false,
        prizeRole: validatedData.prizeRole ?? "NONE",
      },
    });

    return NextResponse.json(
      { message: "Race type updated successfully", raceType: updatedRaceType },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating race type:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const guard3 = await requirePermission("schemes.manage");
    if ("error" in guard3) return guard3.error;
    if (!session || !session.user.role || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Race type ID is required" },
        { status: 400 }
      );
    }

    await prisma.raceType.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: "Race type deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting race type:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
