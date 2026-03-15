import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  breederId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))),
});

const updateTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const breederId = searchParams.get("breederId");

    if(!breederId){
        return NextResponse.json(
          { message: "Breeder ID is required" },
          { status: 400 }
        );
    }

    const breederIdInt = parseInt(breederId);

    // Admins can view any breeder's teams; breeders can only view their own
    if (!["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
      if (!breeder || breeder.id !== breederIdInt) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
    }

    const teams = await prisma.team.findMany({
        where:{
            breederId: breederIdInt
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

    const body = await request.json();
    const validatedData = createTeamSchema.parse(body);

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Admins can create teams for any breeder; breeders can only create for themselves
    if (!["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
      if (!breeder || breeder.id !== validatedData.breederId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
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

    if (!session || !session.user) {
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
    const teamIdInt = parseInt(teamId);

    // Check if team exists and get its owner
    const existingTeam = await prisma.team.findUnique({
      where: { id: teamIdInt },
    });

    if (!existingTeam) {
      return NextResponse.json(
        { message: "Team not found" },
        { status: 404 }
      );
    }

    // Breeders can only update their own teams
    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    if (!breeder || breeder.id !== existingTeam.breederId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamIdInt },
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

    if (!session || !session.user) {
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

    const teamIdInt = parseInt(teamId);

    // Check if team exists and get its owner
    const existingTeam = await prisma.team.findUnique({
      where: { id: teamIdInt },
    });

    if (!existingTeam) {
      return NextResponse.json(
        { message: "Team not found" },
        { status: 404 }
      );
    }

    // Breeders can only delete their own teams
    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    if (!breeder || breeder.id !== existingTeam.breederId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await prisma.team.delete({
      where: { id: teamIdInt },
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
