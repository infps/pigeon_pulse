import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireBirdOwner } from "@/lib/roles";
import { computePaymentTotals } from "@/lib/paymentStatus";
import { GATE_BIT, HOTSPOT_GATES, hotspotSettled, type HotspotGate } from "@/lib/fee-calculator";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * What this breeder owes, bird by bird.
 *
 * Registration produced a single total and a single pending payment, which
 * answers "how much" and nothing else. The question a breeder actually asks is
 * "what am I paying for" — and with a graduated perch fee, a hotspot gate and a
 * race fee that only some birds carry, the total on its own is unarguable in
 * the worst way: correct, and impossible to check.
 *
 * So this returns the stored per-item values rather than recomputing them.
 * Recomputing would show what the bird *would* cost today, which quietly
 * diverges from what it was actually charged the moment a scheme is edited.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const refusal = requireBirdOwner(session);
    if (refusal) return refusal;

    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam, 10);
    if (Number.isNaN(eventId)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const url = new URL(request.url);
    const seasonIdParam = url.searchParams.get("seasonId");
    let seasonId: number;
    if (seasonIdParam) {
      seasonId = parseInt(seasonIdParam, 10);
    } else {
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
      seasonId = active.id;
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
      where: { seasonId, breederId: breeder.id },
      select: {
        id: true,
        hotspotsPaidMask: true,
        cashPromised: true,
        items: {
          orderBy: { birdNo: "asc" },
          select: {
            id: true,
            birdNo: true,
            isBackup: true,
            entryFeeValue: true,
            perchFeeValue: true,
            hotSpotFeeValue: true,
            hotSpot1FeeValue: true,
            hotSpot2FeeValue: true,
            hotSpot3FeeValue: true,
            hotSpotFinalFeeValue: true,
            raceFeeValue: true,
            entryRefund: true,
            hotSpotRefund: true,
            bird: { select: { band: true, birdName: true } },
            raceItems: {
              select: {
                status: true,
                race: { select: { id: true, name: true, raceNumber: true } },
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            paymentValue: true,
            status: true,
            paymentDate: true,
            paymentDesc: true,
            paymentType: true,
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

    const settled = hotspotSettled(inventory.hotspotsPaidMask);

    const items = inventory.items.map((item) => {
      const entry = item.entryFeeValue ?? 0;
      const perch = item.perchFeeValue ?? 0;
      const race = item.raceFeeValue ?? 0;

      // Only one hotspot gate is ever charged, so the bird's hotspot cost is
      // the gate it settled at — or, while unsettled, the cheapest on offer.
      const gates = {
        HS1: item.hotSpot1FeeValue ?? 0,
        HS2: item.hotSpot2FeeValue ?? 0,
        HS3: item.hotSpot3FeeValue ?? 0,
        FINAL: item.hotSpotFinalFeeValue ?? 0,
      };
      const paidGate = HOTSPOT_GATES.find(
        (g) => (inventory.hotspotsPaidMask & (1 << GATE_BIT[g])) !== 0
      );
      const nextGate = HOTSPOT_GATES.find((g) => gates[g] > 0) ?? null;
      const hotspotDue = paidGate ? gates[paidGate] : nextGate ? gates[nextGate] : 0;

      return {
        inventoryItemId: item.id,
        birdNo: item.birdNo,
        band: item.bird?.band ?? null,
        birdName: item.bird?.birdName ?? null,
        isBackup: item.isBackup === 1,
        entryFeeValue: entry,
        perchFeeValue: perch,
        hotSpotFeeValue: item.hotSpotFeeValue ?? 0,
        hotspotGates: gates,
        hotspotDue,
        raceFeeValue: race,
        refunds: (item.entryRefund ?? 0) + (item.hotSpotRefund ?? 0),
        total: entry + perch + hotspotDue + race,
        raceItems: item.raceItems.map((ri) => ({
          raceId: ri.race?.id ?? null,
          raceName: ri.race?.name ?? `Race ${ri.race?.raceNumber ?? ""}`.trim(),
          status: ri.status,
        })),
      };
    });

    const totalOwed = items.reduce((sum, i) => sum + i.total, 0);

    // Reuse the ledger's own rules rather than re-deriving "what counts as
    // paid" — payouts are money out, bet stakes are not registration fees.
    const status = computePaymentTotals(
      inventory.items,
      inventory.payments,
      inventory.hotspotsPaidMask
    );

    const hotspots = HOTSPOT_GATES.map((gate: HotspotGate) => ({
      gate,
      paid: (inventory.hotspotsPaidMask & (1 << GATE_BIT[gate])) !== 0,
      amount: items.reduce((sum, i) => sum + i.hotspotGates[gate], 0),
    }));

    return NextResponse.json({
      eventInventoryId: inventory.id,
      seasonId,
      totalOwed: Math.round(totalOwed * 100) / 100,
      totalPaid: status.totalPaid,
      balance: Math.round((totalOwed - status.totalPaid) * 100) / 100,
      cashPromised: inventory.cashPromised,
      hotspotSettled: settled,
      hotspots,
      items,
      payments: inventory.payments.map((p) => ({
        id: p.id,
        value: p.paymentValue,
        status: p.status,
        date: p.paymentDate,
        desc: p.paymentDesc,
        type: p.paymentType,
      })),
    });
  } catch (error) {
    console.error("Failed to build fee breakdown:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
