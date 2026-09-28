import { auth } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  inventoryItemId: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

/**
 * Birds excluded from this race's results.
 *
 * HayLoft had RACE_IGNORE_BIRD for the "it didn't really fly" case — a bird
 * that went back to the loft, was scanned in error, or should not be ranked
 * for any other reason. The table came across with 612 rows but was never
 * applied to results and had no interface.
 *
 * The result engine now excludes these birds from both the position and
 * hotspot rankings, so marking one requires a recalculation to take effect.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requireAnyPermission(["races.view", "races.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    if (Number.isNaN(raceIdInt)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const ignored = await prisma.raceIgnoreBird.findMany({
      where: { raceId: raceIdInt },
      include: {
        inventoryItem: {
          select: {
            id: true,
            bird: {
              select: { id: true, band1: true, band2: true, band3: true, band4: true, birdName: true },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ ignored, count: ignored.length });
  } catch (error) {
    console.error("Error listing ignored birds:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/** Mark a bird as ignored for this race. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    if (Number.isNaN(raceIdInt)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const { inventoryItemId, note } = bodySchema.parse(await request.json());

    // The bird has to actually be in this race for ignoring it to mean anything.
    const raceItem = await prisma.raceItem.findFirst({
      where: { raceId: raceIdInt, inventoryItemId },
      select: { id: true },
    });
    if (!raceItem) {
      return NextResponse.json(
        { message: "That bird is not entered in this race." },
        { status: 400 }
      );
    }

    const existing = await prisma.raceIgnoreBird.findFirst({
      where: { raceId: raceIdInt, inventoryItemId },
    });

    const record = existing
      ? await prisma.raceIgnoreBird.update({
          where: { id: existing.id },
          data: { note: note ?? existing.note },
        })
      : await prisma.raceIgnoreBird.create({
          data: { raceId: raceIdInt, inventoryItemId, note: note ?? null },
        });

    await prisma.birdEventHistory.create({
      data: {
        eventInventoryItemId: inventoryItemId,
        action: "STATUS_CHANGED",
        detail: `Excluded from race ${raceIdInt} results${note ? `: ${note}` : ""}`,
        performedById: session.user.id ?? null,
      },
    });

    return NextResponse.json({
      ignoreBird: record,
      message: existing
        ? "Note updated. Recalculate the race to apply it."
        : "Bird excluded from results. Recalculate the race to apply it.",
      needsRecalculation: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request", issues: error.issues }, { status: 400 });
    }
    console.error("Error ignoring bird:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/** Stop ignoring a bird for this race. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    const inventoryItemId = Number(
      new URL(request.url).searchParams.get("inventoryItemId")
    );
    if (Number.isNaN(raceIdInt) || Number.isNaN(inventoryItemId) || !inventoryItemId) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    const deleted = await prisma.raceIgnoreBird.deleteMany({
      where: { raceId: raceIdInt, inventoryItemId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ message: "That bird was not excluded." }, { status: 404 });
    }

    await prisma.birdEventHistory.create({
      data: {
        eventInventoryItemId: inventoryItemId,
        action: "STATUS_CHANGED",
        detail: `Re-included in race ${raceIdInt} results`,
        performedById: session.user.id ?? null,
      },
    });

    return NextResponse.json({
      message: "Bird re-included. Recalculate the race to apply it.",
      needsRecalculation: true,
    });
  } catch (error) {
    console.error("Error un-ignoring bird:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
