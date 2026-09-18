import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalcRace } from "@/lib/race-results";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Rebuild a race's results — port of HayLoft's RACE_RECALC.
 *
 * Re-runs position ranking, hotspot ranking and prize calculation from the
 * current arrival times, payment flags and ignore list. This is the operator's
 * remedy after correcting a mis-scan, marking a bird as ignored, or recording a
 * payment that should have counted toward the final race.
 *
 * Idempotent — every stage clears before it writes.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    if (Number.isNaN(raceIdInt)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
      select: { id: true, status: true, name: true },
    });

    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }

    if (race.status === "REGISTERING") {
      return NextResponse.json(
        { message: "This race has not started yet, so there are no results to recalculate." },
        { status: 400 }
      );
    }

    // ?dryRun=1 computes the full result and reports what would change without
    // writing anything — a preview before overwriting money on a closed race.
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    const summary = await recalcRace(raceIdInt, { dryRun });

    const verb = dryRun ? "Would recalculate" : "Recalculated";
    return NextResponse.json(
      {
        summary,
        message:
          summary.prizeRole === "NONE"
            ? `${verb} ${summary.positionsAssigned} positions. This race type carries no prize.`
            : `${verb} ${summary.positionsAssigned} positions and ${summary.prizesAwarded} prizes (${summary.changedCount} rows change).`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error recalculating race:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
