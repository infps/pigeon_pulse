import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { AverageFilterMode } from "@/generated/prisma/enums";

type Params = { params: Promise<{ eventId: string }> };

async function resolveSeasonId(eventId: number, seasonIdParam: string | null): Promise<number | null> {
  if (seasonIdParam) {
    const sid = parseInt(seasonIdParam);
    return isNaN(sid) ? null : sid;
  }
  const active = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    select: { id: true },
  });
  return active?.id ?? null;
}

// GET /api/admin/event/[eventId]/averages?seasonId=X
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = await resolveSeasonId(parseInt(eventId), searchParams.get("seasonId"));
    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const configs = await prisma.averageConfig.findMany({
      where: { seasonId },
      include: {
        selectedRaceTypes: { include: { raceType: { select: { id: true, name: true } } } },
        selectedRaces: { include: { race: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching average configs:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/event/[eventId]/averages
// Body: { name, isPublic?, filterMode, seasonId?, raceTypeIds?, raceIds? }
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { eventId } = await params;
    const body = await request.json();
    const { name, isPublic, filterMode, seasonId: seasonIdParam, raceTypeIds, raceIds } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ message: "name required" }, { status: 400 });
    }
    if (filterMode && !Object.values(AverageFilterMode).includes(filterMode)) {
      return NextResponse.json({ message: "Invalid filterMode" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(parseInt(eventId), seasonIdParam ? String(seasonIdParam) : null);
    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const config = await prisma.averageConfig.create({
      data: {
        seasonId,
        name,
        isPublic: isPublic ?? false,
        filterMode: filterMode ?? AverageFilterMode.ALL,
        selectedRaceTypes: {
          create: (raceTypeIds ?? []).map((id: number) => ({ raceTypeId: id })),
        },
        selectedRaces: {
          create: (raceIds ?? []).map((id: number) => ({ raceId: id })),
        },
      },
      include: {
        selectedRaceTypes: true,
        selectedRaces: true,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Error creating average config:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
