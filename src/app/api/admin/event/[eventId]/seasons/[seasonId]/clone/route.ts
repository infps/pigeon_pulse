import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloneSeason } from "@/lib/season-clone";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Stand up a new season from this one — the reusable replacement for HayLoft's
 * hardcoded P_CLONE_* scripts.
 *
 * Copies configuration only. Results, payments, bets, baskets and groups never
 * carry forward.
 */
const bodySchema = z.object({
  name: z.string().min(1).max(120),
  startDate: z.string(),
  endDate: z.string(),
  activate: z.boolean().optional(),
  include: z
    .object({
      schemes: z.boolean().optional(),
      stations: z.boolean().optional(),
      races: z.boolean().optional(),
      prizeValues: z.boolean().optional(),
      statusPresets: z.boolean().optional(),
      averageConfigs: z.boolean().optional(),
      raceNumbers: z.boolean().optional(),
      calcutta: z.boolean().optional(),
      registrations: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; seasonId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId, seasonId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    const seasonIdInt = parseInt(seasonId, 10);
    if (Number.isNaN(eventIdInt) || Number.isNaN(seasonIdInt)) {
      return NextResponse.json({ message: "Invalid event or season ID" }, { status: 400 });
    }

    const body = bodySchema.parse(await request.json());

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ message: "Start and end dates must be valid." }, { status: 400 });
    }

    const source = await prisma.season.findFirst({
      where: { id: seasonIdInt, eventId: eventIdInt },
      select: { id: true, name: true },
    });
    if (!source) {
      return NextResponse.json(
        { message: "That season does not belong to this event." },
        { status: 404 }
      );
    }

    const summary = await cloneSeason(seasonIdInt, {
      name: body.name,
      startDate,
      endDate,
      activate: body.activate,
      include: body.include,
    });

    const parts = Object.entries(summary.copied)
      .filter(([, count]) => count > 0)
      .map(([what, count]) => `${count} ${what.replace(/([A-Z])/g, " $1").toLowerCase().trim()}`);

    return NextResponse.json({
      summary,
      message: `Created "${summary.newSeasonName}" from "${source.name}"${
        parts.length > 0 ? ` with ${parts.join(", ")}` : ""
      }.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "A name and valid start and end dates are required." },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to copy the season";
    const isUserError = /no longer exists|cannot end before/i.test(message);
    if (!isUserError) console.error("Season clone failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}
