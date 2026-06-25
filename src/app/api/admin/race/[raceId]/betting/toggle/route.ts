import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// POST /api/admin/race/[raceId]/betting/toggle
// Opens or closes betting on a race. Enforces one-at-a-time per event.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
    if (newValue && race.eventId) {
      const alreadyOpen = await prisma.race.findFirst({
        where: {
          eventId: race.eventId,
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

    return NextResponse.json({ bettingOpen: updated.bettingOpen });
  } catch (error) {
    console.error("Error toggling betting:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
