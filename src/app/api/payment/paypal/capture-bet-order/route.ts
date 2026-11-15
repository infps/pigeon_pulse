import { auth } from "@/lib/auth";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { holdExpired, releaseHold, settleBetCapture } from "@/lib/bet-hold";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

// Clients still send raceId/selections; they are ignored. What gets placed
// and charged is the hold create-bet-order wrote for this order.
const schema = z.object({ orderID: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["BREEDER", "BETTOR"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderID } = schema.parse(body);

    const hold = await prisma.payment.findUnique({ where: { transactionId: orderID } });
    if (!hold || hold.paymentType !== 2 || hold.paymentMethod !== 2 || hold.bettorId !== session.user.id) {
      return NextResponse.json({ message: "Checkout not found" }, { status: 404 });
    }
    const bets = await prisma.bet.findMany({ where: { stakePaymentId: hold.id } });
    const placed = () =>
      NextResponse.json({
        message: "Bets placed and payment captured",
        betsCreated: bets.length,
        paymentId: hold.id,
      });

    // Retry after a capture that already went through.
    if (hold.status === "PAID") return placed();
    if (hold.status === "REFUNDED") {
      return NextResponse.json({ message: "This checkout was refunded." }, { status: 409 });
    }

    const race = bets[0]
      ? await prisma.race.findUnique({ where: { id: bets[0].raceId }, select: { status: true } })
      : null;
    const client = paypalClient();
    const order: any = (await client.execute(new paypal.orders.OrdersGetRequest(orderID))).result;

    // Not yet captured and no longer allowed to be: release, never charge.
    if (order.status !== "COMPLETED" && (hold.status !== "PENDING" || holdExpired(hold) || race?.status !== "REGISTERING")) {
      await releaseHold(hold.id);
      return NextResponse.json(
        {
          message:
            race?.status && race.status !== "REGISTERING"
              ? "Betting closed before payment finished. You were not charged."
              : "Your 5-minute hold on these slots ran out. You were not charged — start again.",
        },
        { status: 409 }
      );
    }

    let capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (order.status === "APPROVED") {
      const captureReq = new paypal.orders.OrdersCaptureRequest(orderID);
      captureReq.requestBody({});
      const captured: any = (await client.execute(captureReq)).result;
      capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
    } else if (order.status !== "COMPLETED") {
      return NextResponse.json({ message: "Payment not approved yet", status: order.status }, { status: 400 });
    }
    if (!capture) {
      return NextResponse.json({ message: "No capture data returned from PayPal" }, { status: 502 });
    }

    const outcome = await settleBetCapture(orderID, capture);
    if (outcome === "PAID") return placed();
    if (outcome === "PENDING") {
      return NextResponse.json(
        { message: "PayPal is still processing this payment. Your bets confirm once it clears; if your hold runs out first you are refunded." },
        { status: 202 }
      );
    }
    return NextResponse.json(
      { message: "Your slots were released before payment finished. The payment has been refunded." },
      { status: 409 }
    );
  } catch (error) {
    console.error("capture-bet-order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to capture bet order" }, { status: 500 });
  }
}
