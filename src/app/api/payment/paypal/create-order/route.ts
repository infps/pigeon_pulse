import { auth } from "@/lib/auth";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createOrderSchema = z.object({
  eventInventoryId: z.number(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
});

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "BREEDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventInventoryId, amount, currency } = createOrderSchema.parse(body);

    // Verify eventInventory belongs to this breeder
    const eventInventory = await prisma.eventInventory.findFirst({
      where: { id: eventInventoryId },
      include: {
        breeder: { select: { userId: true } },
        event: { select: { name: true } },
      },
    });

    if (!eventInventory || eventInventory.breeder?.userId !== session.user.id) {
      return NextResponse.json({ message: "Event inventory not found" }, { status: 404 });
    }

    // Create PayPal order
    const requestBody = new paypal.orders.OrdersCreateRequest();
    requestBody.prefer("return=representation");
    requestBody.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          description: `Registration: ${eventInventory.event?.name || "Event"}`,
          custom_id: `${eventInventoryId}`, // Store eventInventoryId for webhook
        },
      ],
      application_context: {
        brand_name: "Pigeon Pulse",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/paypal/return`,
        cancel_url: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/paypal/cancel`,
      },
    });

    const client = paypalClient();
    const orderResponse = await client.execute(requestBody);

    return NextResponse.json({
      orderID: orderResponse.result.id,
      status: orderResponse.result.status,
    });
  } catch (error) {
    console.error("PayPal create order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create PayPal order" }, { status: 500 });
  }
}
