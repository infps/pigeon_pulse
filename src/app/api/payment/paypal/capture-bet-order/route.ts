import { auth } from "@/lib/auth";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  orderID: z.string(),
  raceId: z.number().int().positive(),
  selections: z.array(
    z.object({
      raceItemId: z.number().int().positive(),
      category: z.enum(["BELGIAN", "STANDARD", "WTA"]),
      tierIndex: z.number().int().min(1).max(7),
    })
  ).min(1),
});

function getTierAmount(
  scheme: Record<string, unknown>,
  category: string,
  tierIndex: number
): number {
  const fieldMap: Record<string, string> = {
    BELGIAN: `belgianShow${tierIndex}`,
    STANDARD: `standardShow${tierIndex}`,
    WTA: `wta${tierIndex}`,
  };
  return Number(scheme[fieldMap[category]] ?? 0);
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["BREEDER", "BETTOR"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderID, raceId, selections } = schema.parse(body);

    // Capture PayPal order first
    const captureReq = new paypal.orders.OrdersCaptureRequest(orderID);
    captureReq.requestBody({});
    const client = paypalClient();
    const captureResponse: any = await client.execute(captureReq);
    const captureData = captureResponse.result;

    if (captureData.status !== "COMPLETED") {
      return NextResponse.json(
        { message: "Payment not completed", status: captureData.status },
        { status: 400 }
      );
    }

    const capture = captureData.purchase_units[0].payments?.captures?.[0];
    if (!capture) {
      return NextResponse.json({ message: "No capture data returned from PayPal" }, { status: 400 });
    }

    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { seasonRel: { include: { bettingScheme: true } } },
    });
    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });

    const scheme = race.seasonRel?.bettingScheme as Record<string, unknown> | null;
    if (!scheme) return NextResponse.json({ message: "No betting scheme" }, { status: 400 });

    // Get owner info for each selection
    const raceItems = await prisma.raceItem.findMany({
      where: { id: { in: selections.map((s) => s.raceItemId) } },
      include: { inventoryItem: { include: { eventInventory: { include: { breeder: true } } } } },
    });
    const raceItemMap = new Map(raceItems.map((ri) => [ri.id, ri]));

    // Build bet data
    const betData = selections.map((sel) => {
      const ri = raceItemMap.get(sel.raceItemId);
      const ownerUserId = ri?.inventoryItem?.eventInventory?.breeder?.userId ?? null;
      const amount = getTierAmount(scheme, sel.category, sel.tierIndex);
      return { ...sel, ownerUserId, amount };
    });

    const totalPaid = parseFloat(capture.amount.value);

    // Create bets + single payment record in transaction
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentType: 2, // Classes/bets payment
          paymentValue: totalPaid,
          status: "PAID",
          paymentMethod: 2, // PayPal
          bettorId: session.user.id,
          transactionId: capture.id,
          paymentDate: new Date(),
          paymentTimestamp: new Date(),
          paymentDesc: `PayPal bet stake: ${captureData.id}`,
        },
      });

      const bets = [];
      for (const b of betData) {
        try {
          const bet = await tx.bet.create({
            data: {
              raceId,
              raceItemId: b.raceItemId,
              bettorId: session.user.id,
              ownerUserId: b.ownerUserId ?? undefined,
              category: b.category,
              tierIndex: b.tierIndex,
              amount: b.amount,
              status: "PLACED",
              stakePaymentId: payment.id,
            },
          });
          bets.push(bet);
        } catch (e: any) {
          // P2002 = unique constraint — slot taken between validation and capture; skip
          if (e?.code !== "P2002") throw e;
        }
      }

      return { payment, bets };
    });

    return NextResponse.json({
      message: "Bets placed and payment captured",
      betsCreated: result.bets.length,
      paymentId: result.payment.id,
      captureId: capture.id,
    });
  } catch (error) {
    console.error("capture-bet-order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to capture bet order" }, { status: 500 });
  }
}
