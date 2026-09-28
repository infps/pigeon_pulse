import { auth } from "@/lib/auth";
import { paypalClient, paypal } from "@/lib/paypal";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkStatusSchema = z.object({
  orderID: z.string(),
});

/**
 * Check PayPal order status without capturing
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    // Bettors poll this too. create-bet-order and capture-bet-order both admit
    // BREEDER and BETTOR; this route admitted only BREEDER, so a bettor could
    // open an order and capture one, but every poll in between returned 401 —
    // which reads as a payment that never approves.
    if (!session?.user || !["BREEDER", "BETTOR"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderID } = checkStatusSchema.parse(body);

    console.log("[PayPal Check Status] Checking order:", orderID);

    // Get order details from PayPal
    const requestGet = new paypal.orders.OrdersGetRequest(orderID);
    const client = paypalClient();
    const orderResponse: any = await client.execute(requestGet);
    const orderData = orderResponse.result;

    console.log("[PayPal Check Status] Order status:", orderData.status);

    // Check if order is approved (ready to capture)
    const isApproved = orderData.status === "APPROVED";
    const isCompleted = orderData.status === "COMPLETED";

    return NextResponse.json({
      orderID: orderData.id,
      status: orderData.status,
      isApproved,
      isCompleted,
      canCapture: isApproved || isCompleted,
    });
  } catch (error: any) {
    console.error("[PayPal Check Status] Error:", error);

    // PayPal might return 404 for invalid orders
    if (error.statusCode === 404) {
      return NextResponse.json(
        { message: "Order not found", status: "NOT_FOUND", canCapture: false },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Failed to check order status", status: "ERROR", canCapture: false },
      { status: 500 }
    );
  }
}
