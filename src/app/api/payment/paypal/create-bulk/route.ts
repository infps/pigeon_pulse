import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/enums";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createBulkSchema = z.object({
  paymentIds: z.array(z.number()),
  currency: z.string().default("USD"),
});

/**
 * Create PayPal order for multiple payments
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    const body = await request.json();
    const { paymentIds, currency } = createBulkSchema.parse(body);

    if (paymentIds.length === 0) {
      return NextResponse.json({ message: "No payment IDs provided" }, { status: 400 });
    }

    // Verify all payments belong to breeder and are PENDING
    const payments = await prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        breederId: breeder.id,
        status: PaymentStatus.PENDING,
      },
      include: {
        eventInventory: {
          include: { season: { include: { event: { select: { name: true } } } } },
        },
      },
    });

    if (payments.length === 0) {
      return NextResponse.json(
        { message: "No valid pending payments found" },
        { status: 404 }
      );
    }

    // Calculate total
    const totalAmount = payments.reduce((sum, p) => sum + (p.paymentValue || 0), 0);

    if (totalAmount <= 0) {
      return NextResponse.json({ message: "Invalid total amount" }, { status: 400 });
    }

    // Create PayPal order
    const eventNames = [...new Set(payments.map(p => p.eventInventory?.season?.event?.name).filter(Boolean))];
    const description = `Payment for ${eventNames.join(", ") || "events"}`;

    const requestBody = new paypal.orders.OrdersCreateRequest();
    requestBody.prefer("return=representation");
    requestBody.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: totalAmount.toFixed(2),
          },
          description,
          custom_id: `bulk_${paymentIds.join(",")}`, // Store payment IDs for webhook
        },
      ],
      application_context: {
        brand_name: "Pigeon Pulse",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        // Return to simple instruction page instead of trying to deep-link
        return_url: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/paypal/return`,
        cancel_url: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/paypal/cancel`,
      },
    });

    const client = paypalClient();
    const orderResponse: any = await client.execute(requestBody);

    return NextResponse.json({
      orderID: orderResponse.result.id,
      status: orderResponse.result.status,
      amount: totalAmount,
      paymentCount: payments.length,
    });
  } catch (error) {
    console.error("PayPal create bulk order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to create bulk PayPal order" },
      { status: 500 }
    );
  }
}
