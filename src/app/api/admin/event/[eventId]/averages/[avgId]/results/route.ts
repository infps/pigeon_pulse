import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { computeAverageResults } from "@/lib/computeAverages";

type Params = { params: Promise<{ eventId: string; avgId: string }> };

// GET /api/admin/event/[eventId]/averages/[avgId]/results?seasonId=X
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId, avgId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonIdParam = searchParams.get("seasonId");

    const seasonId = seasonIdParam
      ? parseInt(seasonIdParam)
      : (await prisma.season.findFirst({ where: { eventId: parseInt(eventId), isActive: true }, select: { id: true } }))?.id;

    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const config = await prisma.averageConfig.findUnique({ where: { id: parseInt(avgId) } });
    if (!config || config.seasonId !== seasonId) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const results = await computeAverageResults(parseInt(avgId), seasonId);
    return NextResponse.json({ config, results });
  } catch (error) {
    console.error("Error computing average results:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
