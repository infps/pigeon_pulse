import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function requireRaceAccess(raceId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role === "ADMIN") {
    const organizer = await prisma.organizerData.findFirst({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!organizer) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
    const race = await prisma.race.findFirst({
      where: { id: raceId, seasonRel: { event: { createdById: organizer.id } } },
      select: { id: true },
    });
    if (!race) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
  }
  return { session };
}

export async function POST(_req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  try {
    const { raceId: raceIdParam } = await params;
    const raceId = parseInt(raceIdParam);
    if (isNaN(raceId)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const access = await requireRaceAccess(raceId);
    if (access.error) return access.error;

    const race = await prisma.race.update({
      where: { id: raceId },
      data: { transportStatus: "IN_TRANSIT", transportStartedAt: new Date() },
    });
    return NextResponse.json({ race });
  } catch (error) {
    console.error("Error starting transport:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
