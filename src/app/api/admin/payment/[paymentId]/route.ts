import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId: paymentIdParam } = await params;
  const paymentId = parseInt(paymentIdParam);

  if (isNaN(paymentId)) {
    return NextResponse.json({ message: "Invalid payment ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const guard = await requirePermission("payments.manage");
    if ("error" in guard) return guard.error;

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    return NextResponse.json(
      { message: "Payment deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
