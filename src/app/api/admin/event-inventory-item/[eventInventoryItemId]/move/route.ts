import { requirePermission } from "@/lib/authorize";
import { birdMoveOptions } from "@/lib/bird-card";
import { MoveError, moveToBasket, moveToGroup, moveToOwner, moveToPerch } from "@/lib/bird-moves";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Moving a bird's event entry (bird popup, web and mobile).
 *
 *   GET   what it can be moved to: perches, loft groups, baskets, registrations
 *   POST  { kind: "perch", perch } | { kind: "group", groupId }
 *       | { kind: "basket", basketId } | { kind: "owner", eventInventoryId }
 *
 * Perch and owner moves follow HayLoft (PERCH_FEES_RECALC,
 * EVENT_INVENTORY_ITEM_CHANGE): see lib/bird-moves.
 */
const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("perch"), perch: z.number().int().min(1) }),
  z.object({ kind: z.literal("group"), groupId: z.number().int() }),
  z.object({ kind: z.literal("basket"), basketId: z.number().int() }),
  z.object({ kind: z.literal("owner"), eventInventoryId: z.number().int() }),
]);

const PERMISSION = { perch: "birds.manage", owner: "birds.manage", group: "groups.manage", basket: "birds.manage" } as const;

export async function GET(_request: Request, { params }: { params: Promise<{ eventInventoryItemId: string }> }) {
  const guard = await requirePermission("birds.manage");
  if ("error" in guard) return guard.error;
  const id = parseInt((await params).eventInventoryItemId, 10);
  if (Number.isNaN(id)) return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
  const options = await birdMoveOptions(id);
  if (!options) return NextResponse.json({ message: "Bird entry not found" }, { status: 404 });
  return NextResponse.json(options);
}

export async function POST(request: Request, { params }: { params: Promise<{ eventInventoryItemId: string }> }) {
  const id = parseInt((await params).eventInventoryItemId, 10);
  if (Number.isNaN(id)) return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ message: "Validation error", errors: error instanceof z.ZodError ? error.issues : undefined }, { status: 400 });
  }
  const guard = await requirePermission(PERMISSION[body.kind]);
  if ("error" in guard) return guard.error;
  const userId = guard.session.user.id;

  try {
    switch (body.kind) {
      case "perch": {
        const r = await moveToPerch(id, body.perch, userId);
        return NextResponse.json({ ...r, message: `Moved to perch ${r.perch}; perch fees recalculated.` });
      }
      case "group": {
        const r = await moveToGroup(id, body.groupId, userId);
        return NextResponse.json({ ...r, message: `Moved to ${r.group}.` });
      }
      case "basket": {
        const r = await moveToBasket(id, body.basketId, userId);
        return NextResponse.json({ ...r, message: `Moved to ${r.basket}.` });
      }
      case "owner": {
        const r = await moveToOwner(id, body.eventInventoryId, userId);
        return NextResponse.json({ ...r, message: `Moved to ${r.owner}. Entry fee, hot spot fee and class bets cleared; perch fees recalculated.` });
      }
    }
  } catch (error) {
    if (error instanceof MoveError) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Bird move failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
