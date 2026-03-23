import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const captureSchema = z.object({
  orderID: z.string(),
});

/**
 * Capture PayPal payment for existing PENDING payment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    const { paymentId: paymentIdParam } = await params;
    const paymentId = parseInt(paymentIdParam);

    if (isNaN(paymentId)) {
      return NextResponse.json({ message: "Invalid payment ID" }, { status: 400 });
    }

    const body = await request.json();
    const { orderID } = captureSchema.parse(body);

    // Verify payment belongs to breeder
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, breederId: breeder.id },
    });

    if (!payment) {
      return NextResponse.json({ message: "Payment not found" }, { status: 404 });
    }

    // Capture PayPal order
    const requestCapture = new paypal.orders.OrdersCaptureRequest(orderID);
    requestCapture.requestBody({});

    const client = paypalClient();
    const captureResponse = await client.execute(requestCapture);
    const captureData = captureResponse.result;

    if (captureData.status !== "COMPLETED") {
      return NextResponse.json(
        { message: "Payment not completed", status: captureData.status },
        { status: 400 }
      );
    }

    const capture = captureData.purchase_units[0].payments?.captures?.[0];
    if (!capture) {
      return NextResponse.json({ message: "No capture found" }, { status: 400 });
    }

    // Update payment to PAID
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        transactionId: capture.id,
        paymentDate: new Date(),
        paymentTimestamp: new Date(),
        paymentDesc: `PayPal: ${captureData.id}`,
      },
    });

    return NextResponse.json({
      message: "Payment successful",
      orderID: captureData.id,
      captureID: capture.id,
      status: captureData.status,
    });
  } catch (error) {
    console.error("Error capturing payment:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to capture payment" },
      { status: 500 }
    );
  }
}
