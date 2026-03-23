import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Create PayPal order for existing PENDING payment
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

    // Verify payment belongs to this breeder and is PENDING
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        breederId: breeder.id,
        status: PaymentStatus.PENDING,
      },
      include: {
        eventInventory: {
          include: { event: { select: { name: true } } },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { message: "Payment not found or already paid" },
        { status: 404 }
      );
    }

    const amount = payment.paymentValue || 0;
    if (amount <= 0) {
      return NextResponse.json({ message: "Invalid payment amount" }, { status: 400 });
    }

    // Create PayPal order
    const requestBody = new paypal.orders.OrdersCreateRequest();
    requestBody.prefer("return=representation");
    requestBody.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2),
          },
          description: `Payment for ${payment.eventInventory?.event?.name || "Event"}`,
          custom_id: `payment_${paymentId}`, // Store paymentId for webhook
        },
      ],
      application_context: {
        brand_name: "Pigeon Pulse",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${process.env.NEXT_PUBLIC_API_URL}/payment/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_API_URL}/payment/cancel`,
      },
    });

    const client = paypalClient();
    const orderResponse = await client.execute(requestBody);

    return NextResponse.json({
      orderID: orderResponse.result.id,
      status: orderResponse.result.status,
      amount,
      paymentId,
    });
  } catch (error) {
    console.error("Error creating PayPal order for payment:", error);
    return NextResponse.json(
      { message: "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}
