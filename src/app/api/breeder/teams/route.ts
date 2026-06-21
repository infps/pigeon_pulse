import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  breederId: z.union([z.string(), z.number()]).transform(v => parseInt(String(v))).optional(),
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

    let breederIdInt: number;
    if (breederId) {
      breederIdInt = parseInt(breederId);
      if (!["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
        const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
        if (!breeder || breeder.id !== breederIdInt) {
          return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
      }
    } else {
      const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
      breederIdInt = breeder.id;
    }

    const teams = await prisma.team.findMany({
        where:{
            breederId: breederIdInt
        }
    })

    // Enrich each team with birds + events via the real EventInventory.teamId
    // relation (registration binds loft → Team).
    const teamIds = teams.map((t) => t.id);
    const inventories = teamIds.length
      ? await prisma.eventInventory.findMany({
          where: { breederId: breederIdInt, teamId: { in: teamIds } },
          select: {
            teamId: true,
            event: { select: { id: true, name: true } },
            items: {
              select: {
                birdId: true,
                bird: {
                  select: {
                    id: true,
                    band: true,
                    band1: true,
                    band2: true,
                    band3: true,
                    band4: true,
                    birdName: true,
                  },
                },
                raceItems: {
                  select: {
                    race: {
                      select: { id: true, name: true, raceNumber: true, event: { select: { name: true } } },
                    },
                  },
                },
              },
            },
          },
        })
      : [];

    type TeamBird = { id: number; band: string; name: string | null };
    const statsByTeam = new Map<
      number,
      {
        birds: Map<number, TeamBird>;
        races: Map<number, string>;
        events: Map<number, string>;
      }
    >();
    for (const inv of inventories) {
      if (inv.teamId == null) continue;
      const stat =
        statsByTeam.get(inv.teamId) ?? {
          birds: new Map<number, TeamBird>(),
          races: new Map<number, string>(),
          events: new Map<number, string>(),
        };
      if (inv.event?.id != null) {
        stat.events.set(inv.event.id, inv.event.name ?? `Event ${inv.event.id}`);
      }
      for (const item of inv.items) {
        const b = item.bird;
        if (b?.id != null) {
          const band =
            b.band?.trim() ||
            [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") ||
            "No band";
          stat.birds.set(b.id, { id: b.id, band, name: b.birdName });
        } else if (item.birdId != null) {
          stat.birds.set(item.birdId, { id: item.birdId, band: "No band", name: null });
        }
        for (const ri of item.raceItems) {
          const race = ri.race;
          if (!race) continue;
          const label = race.name?.trim()
            || (race.event?.name ? `${race.event.name}${race.raceNumber ? ` #${race.raceNumber}` : ""}` : `Race ${race.id}`);
          stat.races.set(race.id, label);
        }
      }
      statsByTeam.set(inv.teamId, stat);
    }

    const enrichedTeams = teams.map((t) => {
      const stat = statsByTeam.get(t.id);
      return {
        ...t,
        birdCount: stat ? stat.birds.size : 0,
        birds: stat ? Array.from(stat.birds.values()) : [],
        races: stat ? Array.from(stat.races.values()) : [],
        events: stat
          ? Array.from(stat.events.entries()).map(([id, name]) => ({ id, name }))
          : [],
      };
    });

    return NextResponse.json(
      { teams: enrichedTeams, message: "Teams fetched successfully" },
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

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTeamSchema.parse(body);

    let breederIdInt: number;
    if (validatedData.breederId) {
      breederIdInt = validatedData.breederId;
      if (!["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
        const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
        if (!breeder || breeder.id !== breederIdInt) {
          return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
      }
    } else {
      const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
      breederIdInt = breeder.id;
    }

    const existing = await prisma.team.findFirst({
      where: { name: validatedData.name, breederId: breederIdInt },
    });
    if (existing) {
      return NextResponse.json(
        { message: "A team with this name already exists" },
        { status: 409 }
      );
    }

    const newTeam = await prisma.team.create({
      data: {
        name: validatedData.name,
        breederId: breederIdInt,
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
