import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// All races across events for the global calendar view.
// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD to bound by startTime.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const startTime: { not: null; gte?: Date; lte?: Date } = { not: null };
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) startTime.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) startTime.lte = d;
    }

    const races = await prisma.race.findMany({
      where: { startTime },
      select: {
        id: true,
        name: true,
        description: true,
        startTime: true,
        distance: true,
        status: true,
        seasonRel: { select: { event: { select: { id: true, name: true } } } },
      },
      orderBy: { startTime: "asc" },
    });

    const out = races.map(({ seasonRel, ...r }) => ({
      ...r,
      eventId: seasonRel?.event?.id ?? null,
      eventName: seasonRel?.event?.name ?? null,
    }));

    return NextResponse.json({ races: out, count: out.length });
  } catch (error) {
    console.error("Error fetching race calendar:", error);
    return NextResponse.json(
      { error: "Failed to fetch race calendar" },
      { status: 500 },
    );
  }
}
