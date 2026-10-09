import { requirePermission } from "@/lib/authorize";
import { notifySafely } from "@/lib/notifications";
import { computePaymentTotals } from "@/lib/paymentStatus";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const REJECTION_REFUND_REASON = "Registration rejected";

const approvalSchema = z.object({
  ids: z.array(z.coerce.number().int()).min(1),
  action: z.enum(["APPROVE", "REJECT"]),
});

/**
 * Approve or reject registrations, one or many.
 *
 * Rejecting a registration that has already paid leaves the organizer holding
 * the breeder's money, so it records a refund as OWED. That row is the "due to
 * breeder" line until someone marks it refunded. Approving again withdraws it.
 *
 * A rejected registration's birds are out, so every open bet on them is voided.
 * Stakes the breeder already paid on those bets are added to the refund owed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("breeders.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const { ids, action } = approvalSchema.parse(await request.json());
    const approve = action === "APPROVE";

    // Scoped to this event so ids from another event are ignored, not acted on.
    const inventories = await prisma.eventInventory.findMany({
      where: { id: { in: ids }, season: { eventId: eventIdInt } },
      select: {
        id: true,
        seasonId: true,
        approvalStatus: true,
        breeder: { select: { userId: true } },
        payments: {
          select: { id: true, paymentValue: true, paymentDesc: true, paymentType: true, status: true },
        },
        refunds: { select: { amount: true } },
      },
    });
    if (inventories.length === 0) {
      return NextResponse.json(
        { message: "No matching registrations in this event." },
        { status: 404 }
      );
    }

    const target = approve ? "APPROVED" : "REJECTED";
    const changing = inventories.filter((inv) => inv.approvalStatus !== target);
    const now = new Date();

    let refundsOwed = 0;
    let betsVoided = 0;
    await prisma.$transaction(async (tx) => {
      for (const inv of changing) {
        await tx.eventInventory.update({
          where: { id: inv.id },
          data: approve
            ? {
                approvalStatus: "APPROVED",
                approvedAt: now,
                rejectedAt: null,
                approvedById: session.user.id,
                isWaiting: 0,
              }
            : {
                approvalStatus: "REJECTED",
                rejectedAt: now,
                approvedAt: null,
                approvedById: session.user.id,
                isWaiting: 0,
              },
        });

        if (approve) {
          await tx.refund.deleteMany({
            where: { eventInventoryId: inv.id, status: "OWED", reason: REJECTION_REFUND_REASON },
          });
          continue;
        }

        const openBets = await tx.bet.findMany({
          where: { status: "PLACED", raceItem: { inventoryItem: { eventInventoryId: inv.id } } },
          select: { id: true, amount: true, bettorId: true, stakePaymentId: true },
        });
        if (openBets.length > 0) {
          await tx.bet.updateMany({
            where: { id: { in: openBets.map((b) => b.id) } },
            data: { status: "REFUNDED", payoutValue: null },
          });
          betsVoided += openBets.length;
        }

        // Stakes folded into the registration payment are already in `paid`;
        // stakes paid on their own row ("bet stake") are not, so add those.
        const ownBets = openBets.filter(
          (b) => b.stakePaymentId != null && b.bettorId === inv.breeder?.userId
        );
        const paidStakeRows = await tx.payment.findMany({
          where: { id: { in: ownBets.map((b) => b.stakePaymentId!) }, status: "PAID" },
          select: { id: true, paymentDesc: true },
        });
        const separateStakeIds = new Set(
          paidStakeRows
            .filter((p) => p.paymentDesc?.toLowerCase().includes("bet stake"))
            .map((p) => p.id)
        );
        const paidStakes = ownBets
          .filter((b) => separateStakeIds.has(b.stakePaymentId!))
          .reduce((sum, b) => sum + b.amount, 0);

        const paid = computePaymentTotals([], inv.payments).totalPaid;
        const refunded = inv.refunds.reduce((sum, r) => sum + r.amount, 0);
        const due = Math.round((paid + paidStakes - refunded) * 100) / 100;
        if (due > 0) {
          await tx.refund.create({
            data: {
              eventInventoryId: inv.id,
              amount: due,
              reason: REJECTION_REFUND_REASON,
              status: "OWED",
              issuedBy: session.user.id,
            },
          });
          refundsOwed += 1;
        }
      }
    });

    await notifySafely(
      changing
        .filter((inv) => inv.breeder?.userId)
        .map((inv) => ({
          userId: inv.breeder!.userId!,
          kind: approve ? ("REGISTRATION_APPROVED" as const) : ("REGISTRATION_REJECTED" as const),
          title: approve ? "Your registration was approved" : "Your registration was not approved",
          body: approve
            ? "You are in. Your birds now take part in the event."
            : "The organizer did not accept this registration. Anything you paid will be refunded.",
          link: `/events/${eventIdInt}`,
          seasonId: inv.seasonId,
        }))
    );

    const noun = changing.length === 1 ? "registration" : "registrations";
    return NextResponse.json({
      updated: changing.length,
      refundsOwed,
      betsVoided,
      message: `${changing.length} ${noun} ${approve ? "approved" : "rejected"}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Choose at least one registration and an action." },
        { status: 400 }
      );
    }
    console.error("Failed to update registration approval:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
