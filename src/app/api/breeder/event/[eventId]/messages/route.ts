import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSeasonId, MESSAGE_ORDER } from "@/lib/event-messages";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const seasonId = await resolveSeasonId(request, eventId);
    if (seasonId instanceof NextResponse) return seasonId;

    const messages = await prisma.eventMessage.findMany({
      where: { seasonId },
      include: {
        author: {
          select: { id: true, name: true, lastName: true, image: true },
        },
      },
      orderBy: MESSAGE_ORDER,
    });

    return NextResponse.json(
      { messages, message: "Event messages fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event messages:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
