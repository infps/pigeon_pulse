import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const statusMap: Record<string, number> = {
  PENDING: 0,
  PAID: 1,
  PARTIAL: 2,
  FAILED: 3,
  REFUNDED: 4,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    const { paymentId } = await params;
    const id = parseInt(paymentId);

    if (isNaN(id)) {
      return NextResponse.json({ message: "Invalid payment ID" }, { status: 400 });
    }

    const payment = await prisma.payment.findFirst({
      where: { id, breederId: breeder.id },
      include: {
        eventInventory: {
          include: {
            season: { include: { event: { select: { id: true, name: true, eventDate: true } } } },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ message: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({
      payment: { ...payment, status: statusMap[payment.status] ?? 0 },
    });
  } catch (error) {
    console.error("Error fetching payment:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
