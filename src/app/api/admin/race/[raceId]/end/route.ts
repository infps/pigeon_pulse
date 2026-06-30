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

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    if (race.status !== "STARTED") {
      return NextResponse.json(
        { message: "Only a started race can be ended" },
        { status: 400 }
      );
    }

    const updatedRace = await prisma.race.update({
      where: { id: raceIdInt },
      data: {
        status: "ENDED",
        endTime: new Date(),
        isClosed: 1,
      },
      include: {
        raceType: true,
        event: true,
      },
    });

    // Mark all still-released birds as lost
    await prisma.raceItem.updateMany({
      where: { raceId: raceIdInt, status: "RELEASED" },
      data: { isLost: 1, lostRaceId: raceIdInt },
    });

    return NextResponse.json(
      { race: updatedRace, message: "Race ended successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error ending race:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
