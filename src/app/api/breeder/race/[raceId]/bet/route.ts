import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const placeBetSchema = z.object({
  raceItemId: z.number().int().positive(),
  category: z.enum(["BELGIAN", "STANDARD", "WTA"]),
  tierIndex: z.number().int().min(1).max(7),
});

// POST /api/breeder/race/[raceId]/bet
// BREEDER: can bet own birds anytime race is REGISTERING (owner phase).
// BREEDER/BETTOR: can bet any un-bet bird when race.bettingOpen=true (open pool).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["BREEDER", "BETTOR"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);

    const body = await request.json();
    const parsed = placeBetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid input", errors: parsed.error.issues }, { status: 400 });
    }
    const { raceItemId, category, tierIndex } = parsed.data;

    const [race, raceItem] = await Promise.all([
      prisma.race.findUnique({
        where: { id: raceIdInt },
        include: { event: { include: { bettingScheme: true } } },
      }),
      prisma.raceItem.findUnique({
        where: { id: raceItemId },
        include: {
          inventoryItem: {
            include: {
              eventInventory: { include: { breeder: true } },
            },
          },
        },
      }),
    ]);

    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });
    if (!raceItem) return NextResponse.json({ message: "Bird entry not found" }, { status: 404 });
    if (raceItem.raceId !== raceIdInt) {
      return NextResponse.json({ message: "Bird not in this race" }, { status: 400 });
    }
    if (race.status !== "REGISTERING") {
      return NextResponse.json({ message: "Betting is closed — race already started" }, { status: 400 });
    }

    const ownerUserId = raceItem.inventoryItem?.eventInventory?.breeder?.userId ?? null;
    const isOwner = ownerUserId !== null && session.user.id === ownerUserId;

    if (!isOwner && !race.bettingOpen) {
      return NextResponse.json(
        { message: "Open betting not yet available. Breeders may only bet their own birds at this time." },
        { status: 403 }
      );
    }

    const scheme = race.event?.bettingScheme;
    if (!scheme) {
      return NextResponse.json({ message: "No betting scheme assigned to this event" }, { status: 400 });
    }

    const tierField = getTierField(category, tierIndex);
    const amount = tierField ? Number((scheme as Record<string, unknown>)[tierField] ?? 0) : 0;
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { message: `Tier ${category}.${tierIndex} has no entry amount configured` },
        { status: 400 }
      );
    }

    const existing = await prisma.bet.findUnique({
      where: { raceItemId_category_tierIndex: { raceItemId, category, tierIndex } },
    });
    if (existing) {
      return NextResponse.json({ message: "This bird is already in that pool" }, { status: 409 });
    }

    const breeder = raceItem.inventoryItem?.eventInventory?.breeder;
    const eventInventoryId = raceItem.inventoryItem?.eventInventory?.id;

    const [bet, payment] = await prisma.$transaction(async (tx) => {
      const newBet = await tx.bet.create({
        data: {
          raceId: raceIdInt,
          raceItemId,
          bettorId: session.user.id,
          ownerUserId: ownerUserId ?? undefined,
          category,
          tierIndex,
          amount,
          status: "PLACED",
        },
      });

      const newPayment = await tx.payment.create({
        data: {
          paymentType: 2,
          paymentValue: amount,
          paymentDate: new Date(),
          paymentDesc: `Bet stake: ${category} tier ${tierIndex}`,
          status: "PENDING",
          bettorId: session.user.id,
          breederId: breeder?.id ?? undefined,
          eventInventoryId: eventInventoryId ?? undefined,
        },
      });

      await tx.bet.update({
        where: { id: newBet.id },
        data: { stakePaymentId: newPayment.id },
      });

      return [newBet, newPayment];
    });

    return NextResponse.json({ bet, paymentId: payment.id }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ message: "This bird is already in that pool" }, { status: 409 });
    }
    console.error("Error placing bet:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// GET /api/breeder/race/[raceId]/bet — list bettable birds for this race
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["BREEDER", "BETTOR", "ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);

    const [race, raceItems] = await Promise.all([
      prisma.race.findUnique({
        where: { id: raceIdInt },
        include: { event: { include: { bettingScheme: true } } },
      }),
      prisma.raceItem.findMany({
        where: { raceId: raceIdInt },
        include: {
          inventoryItem: {
            include: {
              bird: true,
              eventInventory: { include: { breeder: true } },
            },
          },
          bets: true,
          result: true,
        },
      }),
    ]);

    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });

    // Derive available pools from the event's betting scheme: each non-null tier
    // amount = one pool the breeder can enter a bird into.
    const scheme = race.event?.bettingScheme as Record<string, unknown> | undefined;
    const pools: { category: string; tierIndex: number; amount: number }[] = [];
    if (scheme) {
      const tiers: [string, number, string][] = [];
      for (let i = 1; i <= 7; i++) tiers.push(["BELGIAN", i, `belgianShow${i}`]);
      for (let i = 1; i <= 6; i++) tiers.push(["STANDARD", i, `standardShow${i}`]);
      for (let i = 1; i <= 5; i++) tiers.push(["WTA", i, `wta${i}`]);
      for (const [category, tierIndex, field] of tiers) {
        const amount = Number(scheme[field] ?? 0);
        if (amount > 0) pools.push({ category, tierIndex, amount });
      }
    }

    const stakeIds = raceItems.flatMap((ri) => ri.bets.flatMap((b) => b.stakePaymentId ? [b.stakePaymentId] : []));
    const paidPayments = stakeIds.length > 0
      ? await prisma.payment.findMany({ where: { id: { in: stakeIds }, status: "PAID" }, select: { id: true } })
      : [];
    const paidSet = new Set(paidPayments.map((p) => p.id));

    const birds = raceItems.map((ri) => {
      const breeder = ri.inventoryItem?.eventInventory?.breeder;
      const ownerUserId = breeder?.userId ?? null;
      const ownerName = breeder
        ? [breeder.firstName, breeder.lastName].filter(Boolean).join(" ") || null
        : null;
      return {
        raceItemId: ri.id,
        band: ri.inventoryItem?.bird?.band ?? null,
        ownerUserId,
        ownerName,
        isOwnBird: ownerUserId === session.user.id,
        bets: ri.bets.map((b) => ({
          category: b.category,
          tierIndex: b.tierIndex,
          bettorId: b.bettorId,
          isYours: b.bettorId === session.user.id,
          stakePaymentId: b.stakePaymentId,
          stakePaid: b.stakePaymentId !== null && paidSet.has(b.stakePaymentId),
        })),
      };
    });

    return NextResponse.json({
      birds,
      pools,
      bettingOpen: race.bettingOpen,
      raceStatus: race.status,
    });
  } catch (error) {
    console.error("Error listing bettable birds:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

function getTierField(category: string, tierIndex: number): string | null {
  if (category === "BELGIAN") return `belgianShow${tierIndex}`;
  if (category === "STANDARD") return `standardShow${tierIndex}`;
  if (category === "WTA") return `wta${tierIndex}`;
  return null;
}
