import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Roll back a pending (unpaid) registration.
 * Only permitted when no captured payment exists.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; inventoryId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { inventoryId: inventoryIdParam } = await params;
    const inventoryId = parseInt(inventoryIdParam);
    if (isNaN(inventoryId)) {
      return NextResponse.json({ message: "Invalid inventory id" }, { status: 400 });
    }

    const inventory = await prisma.eventInventory.findFirst({
      where: { id: inventoryId },
      include: {
        breeder: { select: { userId: true } },
        payments: true,
        items: { select: { id: true } },
      },
    });

    if (!inventory || inventory.breeder?.userId !== session.user.id) {
      return NextResponse.json({ message: "Registration not found" }, { status: 404 });
    }

    const hasCaptured = inventory.payments.some(
      (p) => p.status === PaymentStatus.PAID || p.status === PaymentStatus.PARTIAL
    );
    if (hasCaptured) {
      return NextResponse.json(
        { message: "Cannot cancel a paid registration" },
        { status: 400 }
      );
    }

    const itemIds = inventory.items.map((i) => i.id);

    await prisma.$transaction(async (tx) => {
      if (itemIds.length > 0) {
        await tx.raceItem.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
        await tx.basketAssignment.deleteMany({
          where: { eventInventoryItemId: { in: itemIds } },
        });
        await tx.raceIgnoreBird.deleteMany({
          where: { inventoryItemId: { in: itemIds } },
        });
        await tx.avgWinnerPrizes.deleteMany({
          where: { inventoryItemId: { in: itemIds } },
        });
      }
      await tx.eventInventoryItem.deleteMany({ where: { eventInventoryId: inventoryId } });
      await tx.payment.deleteMany({ where: { eventInventoryId: inventoryId } });
      await tx.partner.deleteMany({ where: { eventInventoryId: inventoryId } });
      await tx.eventInventory.delete({ where: { id: inventoryId } });
    });

    return NextResponse.json({ message: "Registration cancelled" });
  } catch (error) {
    console.error("Error cancelling registration:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
