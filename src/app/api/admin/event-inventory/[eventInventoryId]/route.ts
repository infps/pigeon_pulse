import { auth } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventInventoryId: string }> }
) {
  const { eventInventoryId: eventInventoryIdParam } = await params;
  const eventInventoryId = parseInt(eventInventoryIdParam);

  if (isNaN(eventInventoryId)) {
    return NextResponse.json({ message: "Invalid event inventory ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const guard = await requireAnyPermission(["breeders.view", "breeders.manage"]);
    if ("error" in guard) return guard.error;

    const eventInventory = await prisma.eventInventory.findUnique({
      where: { id: eventInventoryId },
      include: {
        breeder: true,
        season: {
          include: {
            bettingScheme: true,
            feeScheme: { include: { birdFeeItems: true } },
          },
        },
        payments: { orderBy: { paymentDate: "desc" } },
        partners: { include: { breeder: true } },
        items: { include: { bird: true }, orderBy: { birdNo: "asc" } },
      },
    });

    if (!eventInventory) {
      return NextResponse.json({ message: "Event inventory not found" }, { status: 404 });
    }

    // Merge items from sibling records (same breeder + event, different inventory ID)
    if (eventInventory.breederId && eventInventory.seasonId) {
      const siblings = await prisma.eventInventory.findMany({
        where: {
          breederId: eventInventory.breederId,
          seasonId: eventInventory.seasonId,
          id: { not: eventInventoryId },
        },
        include: { items: { include: { bird: true }, orderBy: { birdNo: "asc" } } },
      });
      if (siblings.length > 0) {
        const extraItems = siblings.flatMap((s) => s.items);
        (eventInventory as any).items = [...eventInventory.items, ...extraItems];
      }
    }

    return NextResponse.json({ eventInventory, message: "Event inventory fetched successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error fetching event inventory:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH — waiting-list flag/date and admin note on one registration.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventInventoryId: string }> }
) {
  const { eventInventoryId: param } = await params;
  const eventInventoryId = parseInt(param);
  if (isNaN(eventInventoryId)) {
    return NextResponse.json({ message: "Invalid event inventory ID" }, { status: 400 });
  }

  const guard = await requirePermission("breeders.manage");
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json();
    const existing = await prisma.eventInventory.findUnique({
      where: { id: eventInventoryId },
      select: { isWaiting: true, waitingDate: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Event inventory not found" }, { status: 404 });
    }

    const data: { note?: string | null; isWaiting?: number; waitingDate?: Date | null } = {};
    if (body.note !== undefined) data.note = String(body.note).trim() || null;
    if (body.isWaiting !== undefined) {
      const on = body.isWaiting === true || body.isWaiting === 1;
      data.isWaiting = on ? 1 : 0;
      // Turning it on stamps "now" unless the admin supplied a date; off clears it.
      if (!on) data.waitingDate = null;
      else if (body.waitingDate === undefined && !existing.waitingDate) data.waitingDate = new Date();
    }
    if (body.waitingDate !== undefined && data.isWaiting !== 0) {
      const d = body.waitingDate ? new Date(body.waitingDate) : null;
      if (d && isNaN(d.getTime())) {
        return NextResponse.json({ message: "Invalid waiting date" }, { status: 400 });
      }
      data.waitingDate = d;
    }

    const eventInventory = await prisma.eventInventory.update({
      where: { id: eventInventoryId },
      data,
      select: { id: true, note: true, isWaiting: true, waitingDate: true },
    });
    return NextResponse.json({ eventInventory, message: "Registration updated" });
  } catch (error) {
    console.error("Error updating event inventory:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
