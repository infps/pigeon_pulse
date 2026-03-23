import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const captureBulkSchema = z.object({
  orderID: z.string(),
  paymentIds: z.array(z.number()),
});

/**
 * Capture PayPal payment and mark multiple payments as PAID
 */
export async function POST(request: Request) {
  try {
    console.log("[PayPal Capture Bulk] Starting capture");
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      console.log("[PayPal Capture Bulk] Unauthorized");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    const body = await request.json();
    console.log("[PayPal Capture Bulk] Request body:", body);

    const { orderID, paymentIds } = captureBulkSchema.parse(body);
    console.log("[PayPal Capture Bulk] OrderID:", orderID, "PaymentIDs:", paymentIds);

    if (paymentIds.length === 0) {
      console.log("[PayPal Capture Bulk] No payment IDs provided");
      return NextResponse.json({ message: "No payment IDs provided" }, { status: 400 });
    }

    // Verify all payments belong to breeder and are PENDING
    const payments = await prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        breederId: breeder.id,
        status: PaymentStatus.PENDING,
      },
    });

    console.log("[PayPal Capture Bulk] Found payments:", payments.length, "Expected:", paymentIds.length);

    if (payments.length !== paymentIds.length) {
      console.log("[PayPal Capture Bulk] Payment count mismatch");
      return NextResponse.json(
        { message: "Some payments not found or already paid" },
        { status: 404 }
      );
    }

    // Capture PayPal order
    console.log("[PayPal Capture Bulk] Calling PayPal capture API");
    const requestCapture = new paypal.orders.OrdersCaptureRequest(orderID);
    requestCapture.requestBody({});

    const client = paypalClient();
    const captureResponse = await client.execute(requestCapture);
    const captureData = captureResponse.result;
    console.log("[PayPal Capture Bulk] PayPal response status:", captureData.status);

    if (captureData.status !== "COMPLETED") {
      console.log("[PayPal Capture Bulk] Payment not completed, status:", captureData.status);
      return NextResponse.json(
        { message: "Payment not completed", status: captureData.status },
        { status: 400 }
      );
    }

    const capture = captureData.purchase_units[0].payments?.captures?.[0];
    if (!capture) {
      console.log("[PayPal Capture Bulk] No capture found in response");
      return NextResponse.json({ message: "No capture found" }, { status: 400 });
    }

    console.log("[PayPal Capture Bulk] Capture ID:", capture.id);

    // Update all selected payments to PAID
    console.log("[PayPal Capture Bulk] Updating payments to PAID");
    const updateResult = await prisma.payment.updateMany({
      where: { id: { in: paymentIds } },
      data: {
        status: PaymentStatus.PAID,
        transactionId: capture.id,
        paymentDate: new Date(),
        paymentTimestamp: new Date(),
        paymentDesc: `PayPal bulk: ${captureData.id}`,
      },
    });

    console.log("[PayPal Capture Bulk] Updated", updateResult.count, "payments");

    return NextResponse.json({
      message: "Payments successful",
      orderID: captureData.id,
      captureID: capture.id,
      status: captureData.status,
      paymentsUpdated: paymentIds.length,
    });
  } catch (error) {
    console.error("[PayPal Capture Bulk] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to capture bulk payment" },
      { status: 500 }
    );
  }
}
