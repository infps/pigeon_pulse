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

    if (race.status !== "REGISTERING") {
      return NextResponse.json(
        { message: "Race already started" },
        { status: 400 }
      );
    }

    // Start race + release all basketted/checked-in birds
    const [updatedRace] = await prisma.$transaction([
      prisma.race.update({
        where: { id: raceIdInt },
        data: { startTime: new Date(), status: "STARTED" },
        include: {
          raceType: true,
          event: true,
        },
      }),
      prisma.raceItem.updateMany({
        where: {
          raceId: raceIdInt,
          status: { in: ["LOFT_BASKETED", "CHECKED_IN", "REGISTERED"] },
        },
        data: { status: "RELEASED" },
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
