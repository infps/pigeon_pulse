import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MESSAGE_ORDER } from "@/lib/event-messages";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limitRaw = parseInt(searchParams.get("limit") ?? "10");
    const offsetRaw = parseInt(searchParams.get("offset") ?? "0");
    const limit = Math.min(Math.max(isNaN(limitRaw) ? 10 : limitRaw, 1), 100);
    const offset = Math.max(isNaN(offsetRaw) ? 0 : offsetRaw, 0);

    const [rows, total] = await Promise.all([
      prisma.eventMessage.findMany({
        include: {
          season: {
            include: {
              event: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  logoImage: true,
                  bannerImage: true,
                },
              },
            },
          },
          author: {
            select: { id: true, name: true, lastName: true, image: true },
          },
        },
        orderBy: MESSAGE_ORDER,
        take: limit,
        skip: offset,
      }),
      prisma.eventMessage.count(),
    ]);

    // Flatten season.event → event for home/news UI (expects m.event.id)
    const messages = rows
      .filter((m) => m.season?.event)
      .map(({ season, ...rest }) => ({
        ...rest,
        seasonId: rest.seasonId,
        eventId: season!.event.id,
        event: season!.event,
        season: { id: season!.id, name: season!.name },
      }));

    return NextResponse.json(
      { messages, total, message: "Messages fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching breeder messages:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
