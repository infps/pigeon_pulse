import { auth } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const param = new URL(request.url).searchParams.get("seasonId");
  if (param) {
    const parsed = parseInt(param, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const active = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (!active) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return active.id;
}

/**
 * Refunds — money returned to a registration.
 *
 * Recorded as its own row rather than by editing the original payment, so the
 * ledger keeps both sides: what was charged, and what came back. Overwriting the
 * payment would erase the fact that money was ever taken.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requireAnyPermission(["refunds.view", "refunds.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const refunds = await prisma.refund.findMany({
      where: { eventInventory: { seasonId } },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        amount: true,
        reason: true,
        method: true,
        reference: true,
        issuedAt: true,
        paymentId: true,
        eventInventory: {
          select: {
            id: true,
            loft: true,
            breeder: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const total = refunds.reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({ seasonId, refunds, total });
  } catch (error) {
    console.error("Failed to load refunds:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const refundSchema = z.object({
  eventInventoryId: z.coerce.number(),
  amount: z.coerce.number().positive("A refund has to be more than zero"),
  paymentId: z.coerce.number().nullish(),
  reason: z.string().max(500).nullish(),
  method: z.string().max(60).nullish(),
  reference: z.string().max(120).nullish(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("refunds.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const body = refundSchema.parse(await request.json());

    // The registration has to belong to this season, or a refund could be
    // filed against another event's breeder.
    const inventory = await prisma.eventInventory.findFirst({
      where: { id: body.eventInventoryId, seasonId },
      select: {
        id: true,
        breeder: { select: { firstName: true, lastName: true } },
        payments: { where: { status: "PAID" }, select: { paymentValue: true } },
        refunds: { select: { amount: true } },
      },
    });
    if (!inventory) {
      return NextResponse.json(
        { message: "That registration is not part of this season." },
        { status: 400 }
      );
    }

    // Refunding more than was ever paid is almost always a typo, so it is
    // refused rather than quietly recorded.
    const paid = inventory.payments.reduce((sum, p) => sum + (p.paymentValue ?? 0), 0);
    const alreadyRefunded = inventory.refunds.reduce((sum, r) => sum + r.amount, 0);
    const remaining = Math.round((paid - alreadyRefunded) * 100) / 100;

    if (body.amount > remaining) {
      return NextResponse.json(
        {
          message:
            remaining <= 0
              ? "Nothing is left to refund on this registration."
              : `Only ${remaining.toFixed(2)} is left to refund on this registration.`,
          remaining,
        },
        { status: 400 }
      );
    }

    const refund = await prisma.refund.create({
      data: {
        eventInventoryId: body.eventInventoryId,
        paymentId: body.paymentId ?? null,
        amount: body.amount,
        reason: body.reason ?? null,
        method: body.method ?? null,
        reference: body.reference ?? null,
        issuedBy: session.user.id ?? null,
      },
      select: { id: true, amount: true, issuedAt: true },
    });

    const who =
      `${inventory.breeder?.firstName ?? ""} ${inventory.breeder?.lastName ?? ""}`.trim() ||
      "the breeder";

    return NextResponse.json({
      refund,
      message: `${refund.amount.toFixed(2)} refunded to ${who}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "A refund needs a registration and an amount above zero." },
        { status: 400 }
      );
    }
    console.error("Failed to record refund:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
