import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { assessLatePenalties } from "@/lib/late-penalty";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const param = new URL(request.url).searchParams.get("seasonId");
  if (param) {
    const parsed = parseInt(param, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const active = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (!active) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return active.id;
}

/**
 * Late-payment penalties for a season.
 *
 *   GET  — preview who is late and what they would be charged. Writes nothing.
 *   POST — record the assessment. Escalating penalties update the live row for
 *          the same race rather than stacking a second charge.
 *
 * Either accepts ?raceId= to measure against a specific deadline; by default it
 * uses the earliest payment-required race in the season.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("penalties.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const raceIdParam = new URL(request.url).searchParams.get("raceId");
    const raceId = raceIdParam ? parseInt(raceIdParam, 10) : undefined;

    const assessment = await assessLatePenalties(seasonId, {
      raceId: Number.isNaN(raceId) ? undefined : raceId,
      dryRun: true,
    });

    // Anything already on the books, waived or not, so the screen is complete.
    const existing = await prisma.paymentPenalty.findMany({
      where: { eventInventory: { seasonId } },
      orderBy: { assessedAt: "desc" },
      select: {
        id: true,
        eventInventoryId: true,
        raceId: true,
        daysLate: true,
        amount: true,
        assessedAt: true,
        waivedAt: true,
        waiverReason: true,
        waiverProofUrl: true,
        eventInventory: {
          select: {
            loft: true,
            breeder: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json({ assessment, existing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assess penalties";
    const isUserError = /no longer exists/i.test(message);
    if (!isUserError) console.error("Penalty preview failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("penalties.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    let raceId: number | undefined;
    try {
      const body = await request.json();
      if (body?.raceId != null) {
        const parsed = Number(body.raceId);
        if (!Number.isNaN(parsed)) raceId = parsed;
      }
    } catch {
      // No body — use the season's earliest payment-required race.
    }

    const assessment = await assessLatePenalties(seasonId, {
      raceId,
      assessedBy: session.user.id ?? null,
    });

    if (assessment.config.mode === "NONE") {
      return NextResponse.json(
        {
          assessment,
          message:
            "No penalty was charged: this season's fee scheme has late-payment penalties turned off.",
        },
        { status: 200 }
      );
    }

    const tail =
      assessment.skippedCashPromised > 0
        ? ` ${assessment.skippedCashPromised} skipped for having promised cash.`
        : "";

    return NextResponse.json({
      assessment,
      message:
        assessment.applied > 0
          ? `Charged ${assessment.applied} registration${assessment.applied === 1 ? "" : "s"} ` +
            `at ${assessment.daysLate} day${assessment.daysLate === 1 ? "" : "s"} late.${tail}`
          : `Nothing to charge — no registration is past the deadline and grace period.${tail}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assess penalties";
    const isUserError = /no longer exists/i.test(message);
    if (!isUserError) console.error("Penalty assessment failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}
