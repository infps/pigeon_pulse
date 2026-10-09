import { requirePermission } from "@/lib/authorize";
import { NextResponse } from "next/server";
import { deleteEntry, restoreEntry } from "@/lib/bird-substitution";

/**
 * Remove a bird from this event (soft delete), or put it back.
 *
 * POST deletes the entry; DELETE undoes that. The bird record, its results in
 * past races and any bets on it are kept.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  try {
    const guard = await requirePermission("breeders.manage");
    if ("error" in guard) return guard.error;

    const { eventInventoryItemId } = await params;
    const itemId = parseInt(eventInventoryItemId, 10);
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
    }

    const result = await deleteEntry(itemId, guard.session.user.id ?? null);
    return NextResponse.json({ result, message: "Bird removed from the event." });
  } catch (error) {
    console.error("Delete entry failed:", error);
    return NextResponse.json({ message: "Failed to remove the bird from the event" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  try {
    const guard = await requirePermission("breeders.manage");
    if ("error" in guard) return guard.error;

    const { eventInventoryItemId } = await params;
    const itemId = parseInt(eventInventoryItemId, 10);
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
    }

    const result = await restoreEntry(itemId, guard.session.user.id ?? null);
    return NextResponse.json({ result, message: "Bird restored to the event." });
  } catch (error) {
    console.error("Restore entry failed:", error);
    return NextResponse.json({ message: "Failed to restore the bird" }, { status: 500 });
  }
}