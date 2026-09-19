import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { advanceRound, tournamentState } from "@/lib/tournament";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Apply the current round's cut and open the next one.
 *
 * Guarded: the round's race must have ended and no bird may still be recorded
 * in the air, because cutting mid-flight would eliminate birds for not having
 * arrived yet.
 *
 * POST body (manual cuts only): { keepItemIds: number[] }
 */
const bodySchema = z.object({
  keepItemIds: z.array(z.coerce.number()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const guard = await requirePermission("tournaments.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { tournamentId } = await params;
    const id = parseInt(tournamentId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "Invalid tournament ID" }, { status: 400 });
    }

    let keepItemIds: number[] | undefined;
    try {
      keepItemIds = bodySchema.parse(await request.json()).keepItemIds;
    } catch {
      // No body — automatic cut.
    }

    const result = await advanceRound(id, { keepItemIds });

    const tail = result.complete
      ? result.survived === 1
        ? "The tournament is complete — one bird left standing."
        : "The tournament is complete."
      : `Round ${result.nextRoundNumber} is open with ${result.survived} bird${result.survived === 1 ? "" : "s"}.`;

    return NextResponse.json({
      result,
      message:
        `Round ${result.roundNumber} cut: ${result.survived} of ${result.entered} through, ` +
        `${result.eliminated} out` +
        (result.didNotArrive > 0 ? ` (${result.didNotArrive} did not finish)` : "") +
        `. ${tail}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not advance the round";
    const isUserError =
      /no longer exists|already complete|already been cut|no race attached|cannot be cut|still recorded|No birds|needs the birds|None of the selected/i.test(
        message
      );
    if (!isUserError) console.error("Tournament advance failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}

/** Current state of the tournament, for the screen. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const guard = await requirePermission("tournaments.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { tournamentId } = await params;
    const id = parseInt(tournamentId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "Invalid tournament ID" }, { status: 400 });
    }

    const state = await tournamentState(id);
    if (!state) {
      return NextResponse.json({ message: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json({ tournament: state });
  } catch (error) {
    console.error("Failed to load tournament:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
