import { auth } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { seedEntries } from "@/lib/tournament";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Resolve the season to work in — explicit param, else the active season. */
async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const seasonIdParam = new URL(request.url).searchParams.get("seasonId");
  if (seasonIdParam) {
    const parsed = parseInt(seasonIdParam, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const active = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (!active) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return active.id;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requireAnyPermission(["tournaments.view", "tournaments.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const tournaments = await prisma.tournament.findMany({
      where: { seasonId },
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        cutMode: true,
        cutValue: true,
        status: true,
        createdAt: true,
        rounds: {
          orderBy: { roundNumber: "asc" },
          select: {
            id: true,
            roundNumber: true,
            raceId: true,
            status: true,
            survivorCount: true,
            race: { select: { name: true, raceNumber: true, status: true } },
          },
        },
        _count: { select: { entries: true } },
      },
    });

    // "Still in" per tournament, which the list needs to be useful.
    const alive = await prisma.tournamentEntry.groupBy({
      by: ["tournamentId"],
      where: { tournamentId: { in: tournaments.map((t) => t.id) }, eliminatedRound: null },
      _count: { _all: true },
    });
    const aliveById = new Map(alive.map((a) => [a.tournamentId, a._count._all]));

    return NextResponse.json({
      seasonId,
      tournaments: tournaments.map((t) => ({
        ...t,
        entryCount: t._count.entries,
        aliveCount: aliveById.get(t.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error("Failed to list tournaments:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  cutMode: z.enum(["TOP_PERCENT", "TOP_N", "MANUAL"]).default("TOP_PERCENT"),
  cutValue: z.coerce.number().min(0).default(50),
  /** Races to run as rounds, in order. */
  raceIds: z.array(z.coerce.number()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("tournaments.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const body = createSchema.parse(await request.json());

    const tournament = await prisma.tournament.create({
      data: {
        seasonId,
        name: body.name,
        cutMode: body.cutMode,
        cutValue: body.cutValue,
      },
      select: { id: true, name: true },
    });

    // Rounds come from the races the operator picked, in the order given. A
    // tournament with no races yet still gets round 1 so it has somewhere to go.
    const raceIds = body.raceIds ?? [];
    if (raceIds.length > 0) {
      await prisma.tournamentRound.createMany({
        data: raceIds.map((raceId, index) => ({
          tournamentId: tournament.id,
          roundNumber: index + 1,
          raceId,
        })),
      });
    } else {
      await prisma.tournamentRound.create({
        data: { tournamentId: tournament.id, roundNumber: 1 },
      });
    }

    const seeded = await seedEntries(tournament.id);

    return NextResponse.json({
      tournament,
      seeded,
      message: `${tournament.name} created with ${seeded} bird${seeded === 1 ? "" : "s"} entered.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "A tournament name is required." }, { status: 400 });
    }
    console.error("Failed to create tournament:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
