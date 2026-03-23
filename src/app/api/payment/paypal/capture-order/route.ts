import { auth } from "@/lib/auth";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const captureOrderSchema = z.object({
  orderID: z.string(),
  eventInventoryId: z.number(),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderID, eventInventoryId } = captureOrderSchema.parse(body);

    // Verify eventInventory belongs to this breeder
    const eventInventory = await prisma.eventInventory.findFirst({
      where: { id: eventInventoryId },
      include: { breeder: true, payments: true },
    });

    if (!eventInventory || eventInventory.breeder?.userId !== session.user.id) {
      return NextResponse.json({ message: "Event inventory not found" }, { status: 404 });
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

    // Extract payment details
    const capture = captureData.purchase_units[0].payments?.captures?.[0];
    if (!capture) {
      return NextResponse.json({ message: "No capture found" }, { status: 400 });
    }

    // Update or create Payment record
    const pendingPayment = eventInventory.payments.find((p) => p.status === PaymentStatus.PENDING);

    if (pendingPayment) {
      // Update existing PENDING payment to PAID
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: PaymentStatus.PAID,
          transactionId: capture.id,
          paymentDate: new Date(),
          paymentTimestamp: new Date(),
          paymentDesc: `PayPal: ${captureData.id}`,
        },
      });
    } else {
      // Create new payment record (fallback)
      await prisma.payment.create({
        data: {
          eventInventoryId,
          breederId: eventInventory.breederId,
          paymentValue: parseFloat(capture.amount.value),
          status: PaymentStatus.PAID,
          transactionId: capture.id,
          paymentDate: new Date(),
          paymentTimestamp: new Date(),
          paymentDesc: `PayPal: ${captureData.id}`,
        },
      });
    }

    return NextResponse.json({
      message: "Payment successful",
      orderID: captureData.id,
      captureID: capture.id,
      status: captureData.status,
    });
  } catch (error) {
    console.error("PayPal capture order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to capture PayPal order" }, { status: 500 });
  }
}
