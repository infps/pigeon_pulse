import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

    const payments = await prisma.payment.findMany({
      where: { breederId: breeder.id },
      include: {
        eventInventory: {
          include: {
            season: { include: { event: { select: { id: true, name: true, eventDate: true } } } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    // Map status enum to numbers for mobile compatibility
    const statusMap: Record<string, number> = {
      PENDING: 0,
      PAID: 1,
      PARTIAL: 2,
      FAILED: 3,
      REFUNDED: 4,
    };

    const paymentsWithNumericStatus = payments.map((p) => ({
      ...p,
      status: statusMap[p.status] ?? 0,
    }));

    return NextResponse.json({ payments: paymentsWithNumericStatus }, { status: 200 });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
