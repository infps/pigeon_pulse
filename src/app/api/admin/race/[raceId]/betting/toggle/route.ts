import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { notifyBettingOpen } from "@/lib/notifications";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// POST /api/admin/race/[raceId]/betting/toggle
// Opens or closes betting on a race. Enforces one-at-a-time per event.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requirePermission("betting.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);

    const race = await prisma.race.findUnique({ where: { id: raceIdInt } });
    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }
    if (race.status !== "REGISTERING") {
      return NextResponse.json(
        { message: "Can only toggle betting on a race that has not started" },
        { status: 400 }
      );
    }

    const newValue = !race.bettingOpen;

    // Enforce one-at-a-time: if opening, ensure no other race in same event is open
    if (newValue && race.seasonId) {
      const alreadyOpen = await prisma.race.findFirst({
        where: {
          seasonId: race.seasonId,
          bettingOpen: true,
          id: { not: raceIdInt },
        },
      });
      if (alreadyOpen) {
        return NextResponse.json(
          { message: `Race #${alreadyOpen.id} already has betting open for this event. Close it first.` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.race.update({
      where: { id: raceIdInt },
      data: { bettingOpen: newValue },
    });

    // Tell the season when a pool opens; closing needs no announcement.
    if (updated.bettingOpen) await notifyBettingOpen(updated.id);

    return NextResponse.json({ bettingOpen: updated.bettingOpen });
  } catch (error) {
    console.error("Error toggling betting:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
