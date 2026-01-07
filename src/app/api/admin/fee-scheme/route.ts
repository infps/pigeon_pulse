import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFeeSchemeSchema } from "@/lib/zod";
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

    const whereClause = session.user.role === "ADMIN" 
      ? { createdById: session.user.id }
      : {};

    const feeSchemes = await prisma.feeScheme.findMany({
      where: whereClause,
      orderBy: {
        name: "asc",
      },
      include: {
        perchFeeItems: {
          orderBy: {
            birdNo: "asc",
          },
        },
        raceTypes: {
          include: {
            raceType: true,
          },
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
      { feeSchemes, message: "Fee schemes fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching fee schemes:", error);
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
    const validatedData = createFeeSchemeSchema.parse(body);

    const newFeeScheme = await prisma.feeScheme.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        entryFee: validatedData.entryFee,
        isRefundable: validatedData.isRefundable,
        maxBirds: validatedData.maxBirds,
        feesCutPercent: validatedData.feesCutPercent,
        createdById: session.user.id,
        perchFeeItems: {
          create: validatedData.perchFeeItems.map((item) => ({
            birdNo: item.birdNo,
            fee: item.fee,
          })),
        },
        raceTypes: {
          create: validatedData.raceTypes.map((item) => ({
            raceTypeId: item.raceTypeId,
            fee: item.fee,
          })),
        },
      },
      include: {
        perchFeeItems: true,
        raceTypes: {
          include: {
            raceType: true,
          },
        },
      },
    });

    return NextResponse.json(
      { message: "Fee scheme created successfully", feeScheme: newFeeScheme },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating fee scheme:", error);
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
        { message: "Fee scheme ID is required" },
        { status: 400 }
      );
    }

    const validatedData = createFeeSchemeSchema.parse(updateData);

    // Delete existing related records first
    await prisma.$transaction([
      prisma.perchFeeItem.deleteMany({
        where: { feeSchemeId: id },
      }),
      prisma.raceTypeFeeScheme.deleteMany({
        where: { feeSchemeId: id },
      }),
    ]);

    // Update the fee scheme with new data
    const updatedFeeScheme = await prisma.feeScheme.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        entryFee: validatedData.entryFee,
        isRefundable: validatedData.isRefundable,
        maxBirds: validatedData.maxBirds,
        feesCutPercent: validatedData.feesCutPercent,
        perchFeeItems: {
          create: validatedData.perchFeeItems.map((item) => ({
            birdNo: item.birdNo,
            fee: item.fee,
          })),
        },
        raceTypes: {
          create: validatedData.raceTypes.map((item) => ({
            raceTypeId: item.raceTypeId,
            fee: item.fee,
          })),
        },
      },
      include: {
        perchFeeItems: true,
        raceTypes: {
          include: {
            raceType: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Fee scheme updated successfully",
        feeScheme: updatedFeeScheme,
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
    console.error("Error updating fee scheme:", error);
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
        { message: "Fee scheme ID is required" },
        { status: 400 }
      );
    }

    await prisma.feeScheme.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Fee scheme deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting fee scheme:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
