import { auth } from "@/lib/auth";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { activeRaceItemOr } from "@/lib/entry-filters";
import { BET_HOLD_MS, expiredHold, releaseHolds } from "@/lib/bet-hold";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  raceId: z.number().int().positive(),
  selections: z
    .array(
      z.object({
        raceItemId: z.number().int().positive(),
        category: z.enum(["BELGIAN", "STANDARD", "WTA"]),
        tierIndex: z.number().int().min(1).max(7),
      })
    )
    .min(1)
    .refine(
      (sels) => new Set(sels.map((s) => `${s.raceItemId}:${s.category}:${s.tierIndex}`)).size === sels.length,
      "Duplicate selection"
    ),
});

// Stake amounts are configured in USD. Never take the currency from the client.
const currency = "USD";

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
    const { raceId, selections } = schema.parse(body);

    const race = await prisma.race.findUnique({
      where: { id: raceId },
      include: { seasonRel: { include: { bettingScheme: true } } },
    });

    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });
    if (race.status !== "REGISTERING") {
      return NextResponse.json({ message: "Betting closed — race already started" }, { status: 400 });
    }
    const scheme = race.seasonRel?.bettingScheme as Record<string, unknown> | null;
    if (!scheme) {
      return NextResponse.json({ message: "No betting scheme on this event" }, { status: 400 });
    }

    // Free slots whose checkout ran out, and this bettor's own unfinished
    // checkouts for the race: a new checkout replaces the old one, so a
    // retry never double-charges and one bettor cannot stack holds.
    await releaseHolds(raceId, expiredHold());
    await releaseHolds(raceId, { bettorId: session.user.id });

    // Validate each selection and accumulate total
    let total = 0;
    const betData: { raceItemId: number; category: typeof selections[number]["category"]; tierIndex: number; ownerUserId: string | null; amount: number }[] = [];
    for (const sel of selections) {
      const raceItem = await prisma.raceItem.findUnique({
        where: { id: sel.raceItemId, OR: activeRaceItemOr },
        include: { inventoryItem: { include: { eventInventory: { include: { breeder: true } } } } },
      });
      if (!raceItem || raceItem.raceId !== raceId) {
        return NextResponse.json(
          { message: `RaceItem ${sel.raceItemId} not in this race` },
          { status: 400 }
        );
      }

      const ownerUserId = raceItem.inventoryItem?.eventInventory?.breeder?.userId ?? null;
      const isOwner = ownerUserId !== null && session.user.id === ownerUserId;
      if (!isOwner && !race.bettingOpen) {
        return NextResponse.json(
          { message: "Open betting not yet available for this race" },
          { status: 403 }
        );
      }

      // Check slot not already taken
      const existing = await prisma.bet.findUnique({
        where: {
          raceItemId_category_tierIndex: {
            raceItemId: sel.raceItemId,
            category: sel.category,
            tierIndex: sel.tierIndex,
          },
        },
      });
      if (existing) {
        return NextResponse.json(
          { message: `Bird ${sel.raceItemId} already in ${sel.category} tier ${sel.tierIndex}` },
          { status: 409 }
        );
      }

      const amount = getTierAmount(scheme, sel.category, sel.tierIndex);
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { message: `${sel.category} tier ${sel.tierIndex} has no amount configured` },
          { status: 400 }
        );
      }
      total += amount;
      betData.push({ ...sel, ownerUserId, amount });
    }

    if (total <= 0) {
      return NextResponse.json({ message: "Total bet amount is zero" }, { status: 400 });
    }

    const orderReq = new paypal.orders.OrdersCreateRequest();
    orderReq.prefer("return=representation");
    orderReq.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: currency, value: total.toFixed(2) },
          description: `Race bets: ${selections.length} selection(s)`,
          custom_id: `bet:${raceId}`,
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
    const orderResponse: any = await client.execute(orderReq);
    const orderID: string = orderResponse.result.id;
    const links: Array<{ rel: string; href: string }> = orderResponse.result.links || [];
    const approveUrl = links.find((l) => l.rel === "approve")?.href;

    // Hold the slots. If another bettor got one in since the check above, the
    // unique index fails the whole hold; the PayPal order is never approved
    // against anything and simply expires, so nobody is charged.
    const heldAt = new Date();
    await prisma.$transaction(async (tx) => {
      const hold = await tx.payment.create({
        data: {
          paymentType: 2,
          paymentMethod: 2, // PayPal
          paymentValue: total,
          status: "PENDING",
          bettorId: session.user.id,
          transactionId: orderID,
          paymentDate: heldAt,
          paymentTimestamp: heldAt,
          paymentDesc: `PayPal bet checkout (held): ${orderID}`,
        },
      });
      await tx.bet.createMany({
        data: betData.map((b) => ({
          raceId,
          raceItemId: b.raceItemId,
          bettorId: session.user.id,
          ownerUserId: b.ownerUserId ?? undefined,
          category: b.category,
          tierIndex: b.tierIndex,
          amount: b.amount,
          status: "PLACED" as const,
          stakePaymentId: hold.id,
        })),
      });
    });

    return NextResponse.json({
      orderID,
      approveUrl,
      total,
      currency,
      holdExpiresAt: new Date(heldAt.getTime() + BET_HOLD_MS).toISOString(),
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "Someone else just took one of these slots. Refresh and pick again." },
        { status: 409 }
      );
    }
    console.error("create-bet-order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Failed to create bet order" }, { status: 500 });
  }
}
