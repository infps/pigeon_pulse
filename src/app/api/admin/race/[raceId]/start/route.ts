import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);

    // Check if race exists
    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    // Update race: set startTime to now (marks as live) and release all dist-basketed birds
    const [updatedRace] = await prisma.$transaction([
      prisma.race.update({
        where: { id: raceIdInt },
        data: { startTime: new Date() },
        include: {
          raceType: true,
          event: true,
        },
      }),
      // Release all dist-basketed birds (clear distBasketId but keep isDistBasketed for history)
      prisma.raceItem.updateMany({
        where: {
          raceId: raceIdInt,
          isDistBasketed: 1,
        },
        data: {
          distBasketId: null,
        },
      }),
    ]);

    return NextResponse.json(
      { race: updatedRace, message: "Race started successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error starting race:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
