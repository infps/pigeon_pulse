import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBettingSchemeSchema } from "@/lib/zod";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if(session?.user?.role ==="ADMIN"){
      const bettingSchemes = await prisma.bettingScheme.findMany({
        where:{
          createdById: session.user.id
        }
      })
      return NextResponse.json(
        { bettingSchemes, message: "Betting schemes fetched successfully" },
        { status: 200 }
      );
    }
    const bettingSchemes = await prisma.bettingScheme.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
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
      { bettingSchemes, message: "Betting schemes fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching betting schemes:", error);
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
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createBettingSchemeSchema.parse(body);

    const newBettingScheme = await prisma.bettingScheme.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        bettingCutPercent: validatedData.bettingCutPercent,
        belgianShow1: validatedData.belgianShow1,
        belgianShow2: validatedData.belgianShow2,
        belgianShow3: validatedData.belgianShow3,
        belgianShow4: validatedData.belgianShow4,
        belgianShow5: validatedData.belgianShow5,
        belgianShow6: validatedData.belgianShow6,
        belgianShow7: validatedData.belgianShow7,
        standardShow1: validatedData.standardShow1,
        standardShow2: validatedData.standardShow2,
        standardShow3: validatedData.standardShow3,
        standardShow4: validatedData.standardShow4,
        standardShow5: validatedData.standardShow5,
        wta1: validatedData.wta1,
        wta2: validatedData.wta2,
        wta3: validatedData.wta3,
        wta4: validatedData.wta4,
        wta5: validatedData.wta5,
        createdById: session.user.id,
      },
    });

    return NextResponse.json(
      {
        message: "Betting scheme created successfully",
        bettingScheme: newBettingScheme,
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
    console.error("Error creating betting scheme:", error);
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
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Betting scheme ID is required" },
        { status: 400 }
      );
    }

    const validatedData = createBettingSchemeSchema.parse(updateData);

    const updatedBettingScheme = await prisma.bettingScheme.update({
      where: { bettingSchemeId: id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        bettingCutPercent: validatedData.bettingCutPercent,
        belgianShow1: validatedData.belgianShow1,
        belgianShow2: validatedData.belgianShow2,
        belgianShow3: validatedData.belgianShow3,
        belgianShow4: validatedData.belgianShow4,
        belgianShow5: validatedData.belgianShow5,
        belgianShow6: validatedData.belgianShow6,
        belgianShow7: validatedData.belgianShow7,
        standardShow1: validatedData.standardShow1,
        standardShow2: validatedData.standardShow2,
        standardShow3: validatedData.standardShow3,
        standardShow4: validatedData.standardShow4,
        standardShow5: validatedData.standardShow5,
        wta1: validatedData.wta1,
        wta2: validatedData.wta2,
        wta3: validatedData.wta3,
        wta4: validatedData.wta4,
        wta5: validatedData.wta5,
      },
    });

    return NextResponse.json(
      {
        message: "Betting scheme updated successfully",
        bettingScheme: updatedBettingScheme,
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
    console.error("Error updating betting scheme:", error);
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
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Betting scheme ID is required" },
        { status: 400 }
      );
    }

    await prisma.bettingScheme.delete({
      where: { bettingSchemeId: id },
    });

    return NextResponse.json(
      { message: "Betting scheme deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting betting scheme:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
