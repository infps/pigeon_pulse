import { prisma } from "@/lib/prisma";
import { ALL_GATES_MASK } from "@/lib/fee-calculator";

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
      select: { eventInventoryId: true },
    });

    const inventoryIds = Array.from(
      new Set(
        hotspotPayments
          .map((p) => p.eventInventoryId)
          .filter((id): id is number => id != null)
      )
    );
    if (inventoryIds.length === 0) return 0;

    const result = await prisma.eventInventory.updateMany({
      where: { id: { in: inventoryIds } },
      data: { hotspotsPaidMask: ALL_GATES_MASK },
    });
    return result.count;
  } catch (error) {
    console.error("Failed to settle hotspot gates after payment:", error);
    return 0;
  }
}
