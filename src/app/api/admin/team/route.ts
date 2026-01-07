import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  breederId: z.string().min(1, "Breeder ID is required"),
});

const updateTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const breederId = searchParams.get("breederId");

    // Get single team by ID
    if(!breederId){
        return NextResponse.json(
          { message: "Breeder ID is required" },
          { status: 400 }
        );
    }

    const teams = await prisma.team.findMany({
        where:{
            breederId: breederId
        }
    })

    return NextResponse.json(
      { teams, message: "Teams fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching teams:", error);
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
    const validatedData = createTeamSchema.parse(body);

    // Check if breeder exists
    const breeder = await prisma.user.findUnique({
      where: { id: validatedData.breederId },
    });

    if (!breeder) {
      return NextResponse.json(
        { message: "Breeder not found" },
        { status: 404 }
      );
    }

    const newTeam = await prisma.team.create({
      data: {
        name: validatedData.name,
        breederId: validatedData.breederId,
      },
    });

    return NextResponse.json(
      { message: "Team created successfully", team: newTeam },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating team:", error);
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
    const { teamId, ...updateData } = body;

    if (!teamId) {
      return NextResponse.json(
        { message: "Team ID is required" },
        { status: 400 }
      );
    }

    const validatedData = updateTeamSchema.parse(updateData);

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
      },
    });

    return NextResponse.json(
      { message: "Team updated successfully", team: updatedTeam },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating team:", error);
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
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json(
        { message: "Team ID is required" },
        { status: 400 }
      );
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json(
      { message: "Team deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
