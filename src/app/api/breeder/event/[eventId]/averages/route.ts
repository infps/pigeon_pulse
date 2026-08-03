import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string }> };

// GET /api/breeder/event/[eventId]/averages?seasonId=X
// Returns only public average configs for the season
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonIdParam = searchParams.get("seasonId");

    const seasonId = seasonIdParam
      ? parseInt(seasonIdParam)
      : (await prisma.season.findFirst({ where: { eventId: parseInt(eventId), isActive: true }, select: { id: true } }))?.id;

    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const configs = await prisma.averageConfig.findMany({
      where: { seasonId, isPublic: true },
      select: { id: true, name: true, filterMode: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching public averages:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
