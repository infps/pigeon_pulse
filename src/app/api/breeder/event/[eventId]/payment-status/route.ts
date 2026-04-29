import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);

    if (isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const url = new URL(request.url);
    const inventoryIdParam = url.searchParams.get("inventoryId");
    const inventoryId = inventoryIdParam ? parseInt(inventoryIdParam) : null;

    // Target a specific inventory when provided; otherwise use the most recent
    // registration for this breeder+event (avoids returning a stale older one).
    const eventInventory = await prisma.eventInventory.findFirst({
      where: {
        eventId,
        breederId: breeder.id,
        ...(inventoryId ? { id: inventoryId } : {}),
      },
      orderBy: { id: "desc" },
      include: {
        payments: { orderBy: { paymentDate: "desc" } },
      },
    });

    if (!eventInventory) {
      return NextResponse.json({ message: "No registration found" }, { status: 404 });
    }

    // Calculate totals
    const totalPaid = eventInventory.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + (p.paymentValue || 0), 0);

    const totalPending = eventInventory.payments
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + (p.paymentValue || 0), 0);

    const totalDue = totalPending;
    const isPaid = totalDue === 0 || totalPaid >= totalPending;

    return NextResponse.json({
      eventInventoryId: eventInventory.id,
      totalPaid,
      totalPending,
      totalDue,
      isPaid,
      payments: eventInventory.payments,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
