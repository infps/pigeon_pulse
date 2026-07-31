import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Get all PENDING payments for current breeder
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

    const pendingPayments = await prisma.payment.findMany({
      where: {
        breederId: breeder.id,
        status: PaymentStatus.PENDING,
      },
      include: {
        eventInventory: {
          include: {
            season: { include: { event: { select: { id: true, name: true, eventDate: true } } } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    const total = pendingPayments.reduce((sum, p) => sum + (p.paymentValue || 0), 0);

    // Map status to number (0 = PENDING)
    const paymentsWithNumericStatus = pendingPayments.map((p) => ({
      ...p,
      status: 0,
    }));

    return NextResponse.json({
      payments: paymentsWithNumericStatus,
      totalPending: total,
      count: pendingPayments.length,
    });
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
