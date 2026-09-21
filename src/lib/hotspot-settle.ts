import { prisma } from "@/lib/prisma";
import { maskAfterPaying, type HotspotGate } from "@/lib/fee-calculator";

/**
 * Mark the hotspot obligation settled for whatever these payments belong to.
 *
 * Money can land through three different doors — a single capture, a bulk
 * capture, or a webhook arriving after the browser has gone — and a hotspot
 * fee paid by card is not settled until one of them fires. Putting the rule in
 * one place is the only way all three stay in step; the version of this that
 * lived in the capture handler alone left bulk and webhook payments taken but
 * never credited.
 *
 * Settling one gate settles them all, because there is one obligation and four
 * prices for meeting it.
 *
 * Never throws. The money has already moved by the time this runs, and a
 * failure here must not turn a successful capture into an error the payer
 * sees — it leaves the mask unset, which reads as "still owed" and is
 * correctable, rather than losing the payment.
 */
export async function settleHotspotsForPayments(paymentIds: number[]): Promise<number> {
  if (paymentIds.length === 0) return 0;

  try {
    const hotspotPayments = await prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        hotspotGate: { not: null },
        eventInventoryId: { not: null },
      },
      select: { eventInventoryId: true, hotspotGate: true },
    });
    if (hotspotPayments.length === 0) return 0;

    // Bit-or rather than overwrite: a breeder paying gates one at a time must
    // keep the ones already settled, and two captures landing together must
    // not erase each other.
    let touched = 0;
    for (const payment of hotspotPayments) {
      if (payment.eventInventoryId == null || !payment.hotspotGate) continue;
      const current = await prisma.eventInventory.findUnique({
        where: { id: payment.eventInventoryId },
        select: { hotspotsPaidMask: true },
      });
      if (!current) continue;
      const next = current.hotspotsPaidMask | maskAfterPaying(payment.hotspotGate as HotspotGate);
      if (next === current.hotspotsPaidMask) continue;
      await prisma.eventInventory.update({
        where: { id: payment.eventInventoryId },
        data: { hotspotsPaidMask: next },
      });
      touched += 1;
    }
    return touched;
  } catch (error) {
    console.error("Failed to settle hotspot gates after payment:", error);
    return 0;
  }
}
