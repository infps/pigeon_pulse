import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPrizeSchemeSchema } from "@/lib/zod";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // TODO: createdById is now Int (OrganizerData), session.user.id is String. Skip ownership filter until auth bridge.
    const whereClause = {};

    const prizeSchemes = await prisma.prizeScheme.findMany({
      where: whereClause,
      orderBy: {
        name: "asc",
      },
      include: {
        prizeSchemeItems: {
          orderBy: [
            {
              fromPosition: "asc",
            },
          ],
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return NextResponse.json(
      { prizeSchemes, message: "Prize schemes fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching prize schemes:", error);
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
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPrizeSchemeSchema.parse(body);

    const newPrizeScheme = await prisma.prizeScheme.create({
      data: {
        name: validatedData.name,
        // TODO: createdById is now Int (OrganizerData), session.user.id is String. Need auth bridge.
        // createdById: ???,
        prizeSchemeItems: {
          create: validatedData.prizeSchemeItems.map((item) => ({
            fromPosition: item.fromPosition,
            toPosition: item.toPosition,
            prizeValue: item.prizeValue,
          })),
        },
      },
      include: {
        prizeSchemeItems: true,
      },
    });

    return NextResponse.json(
      {
        message: "Prize scheme created successfully",
        prizeScheme: newPrizeScheme,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating prize scheme:", error);
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
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Prize scheme ID is required" },
        { status: 400 }
      );
    }

    const parsedId = parseInt(id);
    const validatedData = createPrizeSchemeSchema.parse(updateData);

    // Delete existing prize scheme items first
    await prisma.prizeSchemeItem.deleteMany({
      where: { prizeSchemeId: parsedId },
    });

    // Update the prize scheme with new data
    const updatedPrizeScheme = await prisma.prizeScheme.update({
      where: { id: parsedId },
      data: {
        name: validatedData.name,
        prizeSchemeItems: {
          create: validatedData.prizeSchemeItems.map((item) => ({
            fromPosition: item.fromPosition,
            toPosition: item.toPosition,
            prizeValue: item.prizeValue,
          })),
        },
      },
      include: {
        prizeSchemeItems: true,
      },
    });

    return NextResponse.json(
      {
        message: "Prize scheme updated successfully",
        prizeScheme: updatedPrizeScheme,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating prize scheme:", error);
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
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Prize scheme ID is required" },
        { status: 400 }
      );
    }

    await prisma.prizeScheme.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: "Prize scheme deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting prize scheme:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
