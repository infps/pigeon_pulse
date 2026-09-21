import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApproved, requireBirdOwner } from "@/lib/roles";
import {
  ALL_GATES_MASK,
  GATE_BIT,
  HOTSPOT_GATES,
  gateAmount,
  hotspotSettled,
  type HotspotGate,
} from "@/lib/fee-calculator";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Settle the hotspot obligation at a chosen gate.
 *
 * There is one obligation and four chances to pay it, priced differently — a
 * real scheme in the legacy data runs 200 / 400 / 800, escalating for leaving
 * it later. Paying at any gate settles it for the season, which is why the mask
 * is filled rather than a single bit set: the question "does this breeder still
 * owe a hotspot fee" has one answer, not four.
 *
 * Recorded on `EventInventory.hotspotsPaidMask` rather than inferred from
 * payment descriptions. `PAYMENT_DESC` is a free-text memo — the legacy data
 * has "ZELLE", "SHIPPING", operators' names and 1,332 blanks in it — and was
 * never a tag. A structured column is the only honest place for this.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const refusal = requireBirdOwner(session) ?? requireApproved(session);
    if (refusal) return refusal;

    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam, 10);
    if (Number.isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const gate = String(body.hotspot ?? "").toUpperCase() as HotspotGate;
    if (!HOTSPOT_GATES.includes(gate)) {
      return NextResponse.json(
        { message: `Pick one of: ${HOTSPOT_GATES.join(", ")}.` },
        { status: 400 }
      );
    }

    const method = String(body.paymentMethod ?? "PAYPAL").toUpperCase();
    if (method !== "PAYPAL" && method !== "CASH") {
      return NextResponse.json(
        { message: "Payment method must be PAYPAL or CASH." },
        { status: 400 }
      );
    }

    const active = await prisma.season.findFirst({
      where: { eventId, isActive: true },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });
    if (!active) {
      return NextResponse.json(
        { message: "This event has no active season yet." },
        { status: 404 }
      );
    }

    const breeder = await prisma.breeder.findFirst({
      where: { userId: session!.user!.id },
      select: { id: true },
    });
    if (!breeder) {
      return NextResponse.json(
        { message: "This account has no breeder record." },
        { status: 404 }
      );
    }

    const inventory = await prisma.eventInventory.findFirst({
      where: { seasonId: active.id, breederId: breeder.id },
      select: {
        id: true,
        hotspotsPaidMask: true,
        items: {
          select: {
            id: true,
            isBackup: true,
            hotSpot1FeeValue: true,
            hotSpot2FeeValue: true,
            hotSpot3FeeValue: true,
            hotSpotFinalFeeValue: true,
          },
        },
      },
    });
    if (!inventory) {
      return NextResponse.json(
        { message: "You are not registered for this season." },
        { status: 404 }
      );
    }

    if (hotspotSettled(inventory.hotspotsPaidMask)) {
      const already = HOTSPOT_GATES.find(
        (g) => (inventory.hotspotsPaidMask & (1 << GATE_BIT[g])) !== 0
      );
      return NextResponse.json(
        {
          message: `The hotspot fee is already settled${already ? ` at ${already}` : ""}. Nothing further is owed.`,
          alreadySettled: true,
        },
        { status: 409 }
      );
    }

    // Backups have not taken a place in the loft and are not charged for one.
    const charged = inventory.items.filter((i) => i.isBackup !== 1);
    const amount =
      Math.round(charged.reduce((sum, i) => sum + gateAmount(i, gate), 0) * 100) / 100;

    if (amount <= 0) {
      return NextResponse.json(
        {
          message: `This season's fee scheme sets no amount for ${gate}, so there is nothing to pay at that gate.`,
        },
        { status: 400 }
      );
    }

    const label = gate === "FINAL" ? "Final" : `Hotspot ${gate.slice(2)}`;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          eventInventoryId: inventory.id,
          breederId: breeder.id,
          paymentValue: amount,
          // 2 = RACES_FEE in the portal's payment taxonomy.
          paymentType: 2,
          paymentMethod: method === "PAYPAL" ? 2 : 0,
          paymentDesc: `${label} entry fee`,
          // Structured, so a capture that rewrites the description still knows
          // what this payment was for.
          hotspotGate: gate,
          paymentDate: new Date(),
          paymentTimestamp: new Date(),
          status: method === "CASH" ? "PAID" : "PENDING",
        },
        select: { id: true, status: true },
      });

      // Cash is settled the moment it is handed over. A card payment is not
      // settled until it captures, so the mask waits for the capture webhook
      // rather than being set on intent.
      if (method === "CASH") {
        await tx.eventInventory.update({
          where: { id: inventory.id },
          data: { hotspotsPaidMask: ALL_GATES_MASK },
        });
      }

      return payment;
    });

    return NextResponse.json({
      ok: true,
      paymentId: result.id,
      status: result.status,
      gate,
      amount,
      birds: charged.length,
      settled: method === "CASH",
      message:
        method === "CASH"
          ? `${label} fee of $${amount.toFixed(2)} recorded. The hotspot fee is now settled for the season.`
          : `${label} fee of $${amount.toFixed(2)} is ready to pay. It settles once the payment captures.`,
    });
  } catch (error) {
    console.error("Failed to start hotspot payment:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
