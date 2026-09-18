import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyBackup, restoreItem } from "@/lib/bird-substitution";

/**
 * Swap a backup bird in for this one (POST), or undo that swap (DELETE).
 *
 * POST body: { incomingItemId?: number }  — omit to take the first eligible
 *            reserve, matching HayLoft's automatic pick.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventInventoryItemId } = await params;
    const itemId = parseInt(eventInventoryItemId, 10);
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
    }

    let incomingItemId: number | undefined;
    try {
      const body = await request.json();
      if (body?.incomingItemId != null) incomingItemId = Number(body.incomingItemId);
    } catch {
      // No body — automatic pick.
    }

    const result = await applyBackup(itemId, { incomingItemId });

    return NextResponse.json({
      result,
      message: `${result.incomingBand} substituted in for ${result.outgoingBand}${
        result.betsRefund ? `; ${result.betsRefund.toFixed(2)} in bet stakes flagged for refund` : ""
      }.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Substitution failed";
    const isUserError =
      /no longer exists|already been replaced|not attached|No eligible|marked lost/i.test(message);
    if (!isUserError) console.error("Backup substitution failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventInventoryItemId } = await params;
    const itemId = parseInt(eventInventoryItemId, 10);
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
    }

    const result = await restoreItem(itemId);
    return NextResponse.json({
      result,
      message: `Bird restored to the lineup as bird ${result.birdNo ?? "?"}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restore failed";
    const isUserError = /no longer exists|was not replaced|not attached/i.test(message);
    if (!isUserError) console.error("Restore failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}

/** Which reserves are available to swap in for this bird. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventInventoryItemId } = await params;
    const itemId = parseInt(eventInventoryItemId, 10);
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
    }

    const item = await prisma.eventInventoryItem.findUnique({
      where: { id: itemId },
      select: { eventInventoryId: true, replacedItemId: true },
    });
    if (!item?.eventInventoryId) {
      return NextResponse.json({ message: "Entry not found" }, { status: 404 });
    }

    const backups = await prisma.eventInventoryItem.findMany({
      where: {
        eventInventoryId: item.eventInventoryId,
        isBackup: 1,
        bird: { NOT: { isLost: 1 } },
      },
      orderBy: { birdNo: "asc" },
      select: {
        id: true,
        birdNo: true,
        perchFeeValue: true,
        bird: {
          select: { band1: true, band2: true, band3: true, band4: true, band: true, birdName: true },
        },
      },
    });

    return NextResponse.json({
      alreadyReplaced: item.replacedItemId != null,
      backups: backups.map((b) => ({
        id: b.id,
        birdNo: b.birdNo,
        band:
          [b.bird?.band1, b.bird?.band2, b.bird?.band3, b.bird?.band4].filter(Boolean).join("-") ||
          b.bird?.band ||
          "",
        birdName: b.bird?.birdName ?? null,
        // Legacy treated a priced reserve as already in play.
        eligible: !b.perchFeeValue,
      })),
    });
  } catch (error) {
    console.error("Failed to list backups:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
