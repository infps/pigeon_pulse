import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { computePaymentStatus } from "@/lib/paymentStatus";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find earliest payment-required race in event
    const paymentRace = await prisma.race.findFirst({
      where: {
        eventId,
        raceType: { isPaymentRequired: true },
        startTime: { not: null },
      },
      orderBy: { startTime: "asc" },
      select: { startTime: true },
    });

    // Defaulter window: 7 days before earliest payment-required race
    const now = new Date();
    const isInDefaulterWindow = paymentRace?.startTime
      ? now >= new Date(paymentRace.startTime.getTime() - 7 * 24 * 60 * 60 * 1000)
      : false;

    const inventories = await prisma.eventInventory.findMany({
      where: { eventId },
      include: {
        breeder: true,
        payments: true,
        items: { include: { bird: true }, orderBy: { birdNo: "asc" } },
      },
    });

    const defaulters = inventories
      .map((inv) => {
        const status = computePaymentStatus(inv.items, inv.payments);
        const isPending = status === "PENDING" || status === "PARTIAL";

        const nonBetNonRefundPaid = inv.payments
          .filter((p) => !p.paymentDesc?.toLowerCase().includes("bet stake") && p.paymentType !== 3)
          .reduce((s, p) => s + (p.paymentValue ?? 0), 0);
        const refundsOut = inv.payments
          .filter((p) => p.paymentType === 3)
          .reduce((s, p) => s + Math.abs(p.paymentValue ?? 0), 0);
        const totalFees = inv.items.reduce(
          (s, i) =>
            s +
            (i.entryFeeValue ?? 0) +
            (i.perchFeeValue ?? 0) +
            (i.raceFeeValue ?? 0) +
            (i.hotSpotFeeValue ?? 0),
          0
        );
        const balanceOwed = totalFees - (nonBetNonRefundPaid - refundsOut);

        return {
          eventInventoryId: inv.id,
          breederId: inv.breederId,
          breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
          loft: inv.loft,
          cashPromised: inv.cashPromised,
          balanceOwed: Math.max(0, balanceOwed),
          birds: inv.items,
          isDefaulter: isPending && isInDefaulterWindow,
        };
      })
      .filter((d) => d.isDefaulter);

    return NextResponse.json({ defaulters, isInDefaulterWindow, paymentRaceDate: paymentRace?.startTime ?? null });
  } catch (error) {
    console.error("Error fetching defaulters:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
