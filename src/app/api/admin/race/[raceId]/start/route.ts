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

    // Check if race exists
    const race = await prisma.race.findUnique({
      where: { raceId },
    });

    if (!race) {
      return NextResponse.json(
        { message: "Race not found" },
        { status: 404 }
      );
    }

    // Update race to live
    const updatedRace = await prisma.race.update({
      where: { raceId },
      data: { isLive: true },
      include: {
        raceType: true,
        event: true,
      },
    });

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
