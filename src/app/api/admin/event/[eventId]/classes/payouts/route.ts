import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcSeasonClassPayouts } from "@/lib/race-classes";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Settle every class in a season against one race.
 *
 *   GET  ?raceId=  — preview; writes nothing
 *   POST { raceId } — commit positions and payouts onto the entries
 *
 * Classes never re-rank anything. They read the finishing positions the race
 * engine has already calculated and divide their own pool accordingly, so a
 * class payout is only as settled as the race behind it.
 */
async function resolve(request: Request, eventId: string) {
  const eventIdInt = parseInt(eventId, 10);
  if (Number.isNaN(eventIdInt)) {
    return { error: NextResponse.json({ message: "Invalid event ID" }, { status: 400 }) };
  }

  const url = new URL(request.url);
  const seasonParam = url.searchParams.get("seasonId");
  let seasonId: number | null = seasonParam ? parseInt(seasonParam, 10) : null;
  if (seasonId != null && Number.isNaN(seasonId)) seasonId = null;

  if (seasonId == null) {
    const active = await prisma.season.findFirst({
      where: { eventId: eventIdInt, isActive: true },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });
    if (!active) {
      return {
        error: NextResponse.json({ message: "No active season for this event" }, { status: 404 }),
      };
    }
    seasonId = active.id;
  }

  return { seasonId };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    const resolved = await resolve(request, eventId);
    if ("error" in resolved) return resolved.error;

    const raceIdParam = new URL(request.url).searchParams.get("raceId");
    const raceId = raceIdParam ? parseInt(raceIdParam, 10) : NaN;
    if (Number.isNaN(raceId)) {
      return NextResponse.json({ message: "A raceId is required" }, { status: 400 });
    }

    const results = await calcSeasonClassPayouts(resolved.seasonId!, raceId);
    return NextResponse.json({ seasonId: resolved.seasonId, raceId, results, committed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not calculate class payouts";
    const isUserError = /no longer exists/i.test(message);
    if (!isUserError) console.error("Class payout preview failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    const resolved = await resolve(request, eventId);
    if ("error" in resolved) return resolved.error;

    const body = await request.json().catch(() => ({}));
    const raceId = Number(body?.raceId);
    if (Number.isNaN(raceId)) {
      return NextResponse.json({ message: "A raceId is required" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: { id: true, status: true, name: true },
    });
    if (!race) {
      return NextResponse.json({ message: "Race not found" }, { status: 404 });
    }
    // Paying out on a race still being flown would settle against a half-built
    // finishing order.
    if (race.status !== "ENDED") {
      return NextResponse.json(
        { message: "Class payouts can only be settled once the race has ended." },
        { status: 400 }
      );
    }

    const results = await calcSeasonClassPayouts(resolved.seasonId!, raceId, { commit: true });
    const paid = results.reduce((sum, r) => sum + r.paid, 0);
    const refunded = results.filter((r) => r.refunded).length;

    return NextResponse.json({
      seasonId: resolved.seasonId,
      raceId,
      results,
      committed: true,
      message:
        `Settled ${results.length} class${results.length === 1 ? "" : "es"}, paying ${paid.toFixed(2)}` +
        (refunded > 0 ? `; ${refunded} too small to pay and marked for refund.` : "."),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not settle class payouts";
    const isUserError = /no longer exists|has ended/i.test(message);
    if (!isUserError) console.error("Class payout failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}
