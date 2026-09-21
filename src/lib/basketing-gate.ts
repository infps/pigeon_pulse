import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computePaymentTotals } from "@/lib/paymentStatus";
import { openHotspotGate } from "@/lib/hotspot-gates";

/**
 * Refuse to basket a bird whose registration has not been settled.
 *
 * Only when the season's fee scheme sets `priorToHotspot1Required`. Default is
 * off, and deliberately: a scanner that starts refusing birds because of an
 * accounting state is a change an organiser has to choose, not one a system
 * should make for them at a basketing table.
 *
 * Cash promised counts as settled. That flag exists precisely for the breeder
 * who is paying at the door, and the ledger already honours it everywhere
 * else — refusing their birds here would contradict the rest of the system.
 *
 * Returns a response to hand straight back, or null to carry on.
 */
export async function requirePaidBeforeBasketing(
  eventInventoryId: number | null,
  seasonId: number
): Promise<NextResponse | null> {
  if (eventInventoryId == null) return null;

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { feeScheme: { select: { priorToHotspot1Required: true } } },
  });
  if (!season?.feeScheme?.priorToHotspot1Required) return null;

  const inventory = await prisma.eventInventory.findUnique({
    where: { id: eventInventoryId },
    select: {
      cashPromised: true,
      hotspotsPaidMask: true,
      breeder: { select: { firstName: true, lastName: true } },
      items: {
        select: {
          entryFeeValue: true,
          perchFeeValue: true,
          raceFeeValue: true,
          hotSpotFeeValue: true,
          hotSpot1FeeValue: true,
          hotSpot2FeeValue: true,
          hotSpot3FeeValue: true,
          hotSpotFinalFeeValue: true,
        },
      },
      payments: {
        select: { paymentValue: true, paymentDesc: true, paymentType: true },
      },
    },
  });
  if (!inventory) return null;

  if (inventory.cashPromised) return null;

  // Priced at the gate the season has actually reached. A breeder who let HS1
  // go by owes HS2's price, and the figure quoted at the basketing table has
  // to be the one they will be asked for.
  const totals = computePaymentTotals(
    inventory.items,
    inventory.payments,
    inventory.hotspotsPaidMask,
    await openHotspotGate(seasonId)
  );

  if (totals.balance <= 0) return null;

  const who =
    `${inventory.breeder?.firstName ?? ""} ${inventory.breeder?.lastName ?? ""}`.trim() ||
    "This breeder";

  return NextResponse.json(
    {
      message:
        `${who} still owes $${totals.balance.toFixed(2)} of $${totals.owed.toFixed(2)}. ` +
        `This season requires payment before basketing. Take the payment, or mark cash promised, then scan again.`,
      paymentRequired: true,
      owed: totals.owed,
      paid: totals.totalPaid,
      balance: totals.balance,
    },
    { status: 402 }
  );
}
