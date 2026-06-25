import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  bettorUserId: z.string(),
  selections: z
    .array(
      z.object({
        raceItemId: z.number().int().positive(),
        category: z.enum(["BELGIAN", "STANDARD", "WTA"]),
        tierIndex: z.number().int().min(1).max(7),
      })
    )
    .min(1),
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);

    const body = await request.json();
    const { bettorUserId, selections } = schema.parse(body);

    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
      include: { event: { include: { bettingScheme: true } } },
    });
    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });
    if (race.status !== "REGISTERING") {
      return NextResponse.json({ message: "Betting closed — race already started" }, { status: 400 });
    }
    const scheme = race.event?.bettingScheme as Record<string, unknown> | null;
    if (!scheme) {
      return NextResponse.json({ message: "No betting scheme on this event" }, { status: 400 });
    }

    // Resolve bettor user → find their Breeder record
    const bettorBreeder = await prisma.breeder.findFirst({
      where: { userId: bettorUserId },
      select: { id: true },
    });
    // bettorBreeder may be null for BETTOR role users — payment still created via bettorId

    // Validate selections + compute total
    let total = 0;
    const betData: {
      raceItemId: number;
      category: "BELGIAN" | "STANDARD" | "WTA";
      tierIndex: number;
      ownerUserId: string | null;
      amount: number;
    }[] = [];

    for (const sel of selections) {
      const raceItem = await prisma.raceItem.findUnique({
        where: { id: sel.raceItemId },
        include: {
          inventoryItem: { include: { eventInventory: { include: { breeder: true } } } },
        },
      });
      if (!raceItem || raceItem.raceId !== raceIdInt) {
        return NextResponse.json(
          { message: `RaceItem ${sel.raceItemId} not in this race` },
          { status: 400 }
        );
      }

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

      const ownerUserId =
        raceItem.inventoryItem?.eventInventory?.breeder?.userId ?? null;
      betData.push({ ...sel, ownerUserId, amount });
      total += amount;
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentType: 2, // Classes/bets stake
          paymentValue: total,
          paymentMethod: 0, // Cash
          status: "PAID",
          bettorId: bettorUserId,
          breederId: bettorBreeder?.id ?? undefined,
          paymentDate: new Date(),
          paymentTimestamp: new Date(),
          paymentDesc: `Cash bet stake — ${selections.length} selection(s)`,
        },
      });

      const bets = [];
      for (const b of betData) {
        const bet = await tx.bet.create({
          data: {
            raceId: raceIdInt,
            raceItemId: b.raceItemId,
            bettorId: bettorUserId,
            ownerUserId: b.ownerUserId ?? undefined,
            category: b.category,
            tierIndex: b.tierIndex,
            amount: b.amount,
            status: "PLACED",
            stakePaymentId: payment.id,
          },
        });
        bets.push(bet);
      }

      return { payment, bets };
    });

    return NextResponse.json({
      message: "Cash bets registered",
      betsCreated: result.bets.length,
      totalPaid: total,
      paymentId: result.payment.id,
    });
  } catch (error) {
    console.error("place-cash-bet error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
