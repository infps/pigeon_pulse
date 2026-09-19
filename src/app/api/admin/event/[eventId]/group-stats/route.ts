import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { groupStats } from "@/lib/scanner-mapping";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Per-group counts for the season — the client-meeting request for
 * "total birds, active, lost, foreign, stray, medical per group".
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("groups.view");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonIdParam = new URL(request.url).searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam, 10);
      if (Number.isNaN(seasonId)) {
        return NextResponse.json({ message: "Invalid season ID" }, { status: 400 });
      }
    } else {
      const active = await prisma.season.findFirst({
        where: { eventId: eventIdInt, isActive: true },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });
      if (!active) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = active.id;
    }

    const stats = await groupStats(seasonId);

    // Season-wide roll-up, so the header does not need the client to add up.
    const totals = stats.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        active: acc.active + s.active,
        lost: acc.lost + s.lost,
        foreign: acc.foreign + s.foreign,
        stray: acc.stray + s.stray,
        ignored: acc.ignored + s.ignored,
        medical: acc.medical + s.medical,
        backup: acc.backup + s.backup,
        unpaid: acc.unpaid + s.unpaid,
      }),
      { total: 0, active: 0, lost: 0, foreign: 0, stray: 0, ignored: 0, medical: 0, backup: 0, unpaid: 0 }
    );

    return NextResponse.json({ seasonId, stats, totals });
  } catch (error) {
    console.error("Failed to compute group stats:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
