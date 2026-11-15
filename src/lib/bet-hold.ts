/**
 * PayPal bet checkout holds.
 *
 * create-bet-order reserves the slots before the bettor goes to PayPal: a
 * PENDING PayPal stake Payment keyed by the order id (transactionId) plus the
 * Bet rows pointing at it. The Bets unique (raceItemId, category, tierIndex)
 * then stops a second bettor from paying for a slot that is already taken.
 *
 * A hold lives BET_HOLD_MS. After that it is no longer captured, and any
 * caller that needs the slot releases it, so an abandoned checkout cannot
 * block a slot for longer than that.
 */
import type { Prisma } from "@/generated/prisma/client";
import { paypalClient, paypal } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";

export const BET_HOLD_MS = 5 * 60 * 1000;

const HOLD = { paymentType: 2, paymentMethod: 2, status: "PENDING" } as const;

export const expiredHold = (): Prisma.PaymentWhereInput => ({
  OR: [{ paymentTimestamp: null }, { paymentTimestamp: { lt: new Date(Date.now() - BET_HOLD_MS) } }],
});

export const holdExpired = (p: { paymentTimestamp: Date | null }) =>
  !p.paymentTimestamp || Date.now() - p.paymentTimestamp.getTime() > BET_HOLD_MS;

/**
 * Mark one hold FAILED and free its slots. Conditional on it still being
 * PENDING, so a capture that got there first keeps its bets.
 */
export async function releaseHold(paymentId: number) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "FAILED" },
    });
    if (count) await tx.bet.deleteMany({ where: { stakePaymentId: paymentId } });
  });
}

/** Release this race's PayPal holds that match `filter` (all of them by default). */
export async function releaseHolds(raceId: number, filter: Prisma.PaymentWhereInput = {}) {
  // ponytail: scans all open PayPal holds; they only live 5 min so the set stays small.
  const holds = await prisma.payment.findMany({ where: { ...HOLD, ...filter }, select: { id: true } });
  if (holds.length === 0) return;
  const inRace = await prisma.bet.findMany({
    where: { raceId, stakePaymentId: { in: holds.map((h) => h.id) } },
    select: { stakePaymentId: true },
    distinct: ["stakePaymentId"],
  });
  for (const b of inRace) await releaseHold(b.stakePaymentId!);
}

type Capture = { id: string; status: string; amount: { value: string; currency_code: string } };

/**
 * Book a PayPal capture against the hold for `orderID`. Safe to call more
 * than once (capture route retry, webhook). Money with no hold behind it —
 * the hold expired, was replaced, or the race started — is refunded.
 */
export async function settleBetCapture(
  orderID: string,
  capture: Capture
): Promise<"PAID" | "PENDING" | "REFUNDED" | "UNKNOWN"> {
  const hold = await prisma.payment.findUnique({ where: { transactionId: orderID } });
  if (!hold) return "UNKNOWN";
  if (capture.status !== "COMPLETED") return "PENDING"; // the webhook settles it when it clears

  const amountOk =
    capture.amount.currency_code === "USD" &&
    Math.abs(parseFloat(capture.amount.value) - (hold.paymentValue ?? 0)) < 0.005;

  if (amountOk) {
    const { count } = await prisma.payment.updateMany({
      where: { id: hold.id, status: "PENDING" },
      data: { status: "PAID", paymentDate: new Date(), paymentDesc: `PayPal bet stake, capture ${capture.id}` },
    });
    if (count) return "PAID";
    const now = await prisma.payment.findUnique({ where: { id: hold.id }, select: { status: true } });
    if (now?.status === "PAID" || now?.status === "REFUNDED") return now.status;
  } else {
    await releaseHold(hold.id);
  }

  // Only the caller that flips FAILED -> REFUNDED sends the refund, so a
  // capture retry racing the webhook cannot refund twice.
  const { count } = await prisma.payment.updateMany({
    where: { id: hold.id, status: "FAILED" },
    data: { status: "REFUNDED", paymentDesc: `Refunded PayPal capture ${capture.id}` },
  });
  if (!count) return "REFUNDED";
  try {
    const req = new paypal.payments.CapturesRefundRequest(capture.id);
    req.requestBody({});
    await paypalClient().execute(req);
  } catch (e) {
    await prisma.payment.update({
      where: { id: hold.id },
      data: { status: "FAILED", paymentDesc: `REFUND NEEDED: PayPal capture ${capture.id}` },
    });
    throw e;
  }
  return "REFUNDED";
}
