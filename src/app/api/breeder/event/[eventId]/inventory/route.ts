import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { approvedInventory } from "@/lib/entry-filters";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const seasonIdParam = searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam);
    } else {
      const activeSeason = await prisma.season.findFirst({
        where: { eventId, isActive: true },
        orderBy: { startDate: "desc" },
      });
      if (!activeSeason) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = activeSeason.id;
    }

    // Others see participants only; a breeder also sees their own registration
    // while it waits for approval.
    const session = await auth.api.getSession({ headers: await headers() });
    const self = session?.user
      ? await prisma.breeder.findUnique({ where: { userId: session.user.id }, select: { id: true } })
      : null;
    const visible = self ? { OR: [approvedInventory, { breederId: self.id }] } : approvedInventory;

    const eventInventory = await prisma.eventInventory.findMany({
      where: { seasonId, ...visible },
      include: {
        breeder: {
          include: {
            user: { select: { id: true, image: true, name: true } },
          },
        },
        items: {
          where: { deletedAt: null },
          include: { bird: true },
        },
      },
      orderBy: { signInDate: "desc" },
    });

    return NextResponse.json(
      { eventInventory, message: "Event inventory fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event inventory:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
