import { requirePermission } from "@/lib/authorize";
import { postSeasonFees } from "@/lib/hayloft-fees";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  seasonId: z.number().int(),
  operation: z.enum(["post_entry", "post_hot_spot"]),
});

/**
 * HayLoft's "post entry" / "post hot spot" (ENTRY_FEE_BATCH_SET): put the fee
 * scheme's entry fee, or Hot Spot 1 fee, on every bird of the season that is
 * still competing — not lost, active, not replaced, not departed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const guard = await requirePermission("accounting.manage");
  if ("error" in guard) return guard.error;

  try {
    const { eventId } = await params;
    const { seasonId, operation } = bodySchema.parse(await request.json());
    const season = await prisma.season.findFirst({
      where: { id: seasonId, eventId: parseInt(eventId, 10) },
      select: { id: true },
    });
    if (!season) return NextResponse.json({ message: "Season not found for this event" }, { status: 404 });

    const result = await postSeasonFees(seasonId, operation);
    if (result.error) return NextResponse.json({ message: result.error }, { status: 400 });

    const what = operation === "post_entry" ? "Entry fee" : "Hot spot fee";
    return NextResponse.json({
      ...result,
      message: `${what} of $${result.amount?.toFixed(2)} posted on ${result.updated} birds.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    console.error("Posting fees failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
