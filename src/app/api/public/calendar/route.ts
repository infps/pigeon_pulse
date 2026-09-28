import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { raceVisibilityFilter } from "@/lib/visibility";

/**
 * Calendar feed.
 *
 * WinCompanion's calendar is decorative — the screenshot shows an empty grid
 * with a category legend. This one is driven by real races, so a date on the
 * calendar is a race that exists.
 *
 *   ?from=ISO&to=ISO    window, defaults to the current month
 *   ?eventId=           restrict to one event
 *
 * Categories come from the race type, which is what the legend is actually
 * distinguishing (hot spot races, training tosses, and so on).
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const visibility = await raceVisibilityFilter(session?.user?.id, session?.user?.role);

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get("eventId");
    const eventId = eventIdParam ? parseInt(eventIdParam, 10) : null;

    const now = new Date();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toParam
      ? new Date(toParam)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ message: "from and to must be valid dates" }, { status: 400 });
    }

    const races = await prisma.race.findMany({
      where: {
        AND: [
          visibility,
          { startTime: { gte: from, lte: to } },
          ...(eventId != null && !Number.isNaN(eventId)
            ? [{ seasonRel: { eventId } }]
            : []),
        ],
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        name: true,
        raceNumber: true,
        startTime: true,
        endTime: true,
        status: true,
        distance: true,
        raceType: { select: { id: true, name: true, color: true, prizeRole: true } },
        raceStation: { select: { name: true, miles: true } },
        seasonRel: {
          select: { id: true, name: true, event: { select: { id: true, name: true } } },
        },
      },
    });

    const events = races.map((r) => ({
      id: r.id,
      title: r.name || (r.raceNumber != null ? `Race ${r.raceNumber}` : "Race"),
      start: r.startTime,
      end: r.endTime,
      status: r.status,
      category: r.raceType?.name ?? "Race",
      categoryId: r.raceType?.id ?? null,
      color: r.raceType?.color ?? null,
      station: r.raceStation?.name ?? null,
      miles: r.raceStation?.miles ?? r.distance ?? null,
      eventId: r.seasonRel?.event?.id ?? null,
      eventName: r.seasonRel?.event?.name ?? null,
      seasonName: r.seasonRel?.name ?? null,
      href: `/races/${r.id}`,
    }));

    // The legend: only the categories actually present in this window, so it
    // never offers a filter that would empty the view.
    const categories = [
      ...new Map(
        events
          .filter((e) => e.categoryId != null)
          .map((e) => [e.categoryId, { id: e.categoryId, name: e.category, color: e.color }])
      ).values(),
    ];

    return NextResponse.json({ window: { from, to }, events, categories });
  } catch (error) {
    console.error("Failed to load calendar:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
