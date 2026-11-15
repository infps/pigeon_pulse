/**
 * Which pending payment a PayPal registration order is for.
 *
 * A registration can hold more than one PENDING payment (the registration
 * itself, a hot spot gate, a bet stake). The order and the capture must agree
 * on the same row, and a capture must never mark a row paid for an amount it
 * was not raised for. So:
 *
 *   - the order charges the oldest pending payment (lowest id) — deterministic;
 *   - a capture already recorded (same PayPal capture id) is not recorded again,
 *     which makes the capture endpoint and the webhook safe to both arrive;
 *   - a capture marks the oldest pending payment whose amount matches to the
 *     cent; if none matches it is recorded as a new row, never forced onto one.
 */

export interface PendingCandidate {
  id: number;
  status: string;
  paymentValue: number | null;
  transactionId?: string | null;
}

const cents = (n: number) => Math.round(n * 100);

export function oldestPending<T extends PendingCandidate>(payments: ReadonlyArray<T>): T | null {
  return [...payments].filter((p) => p.status === "PENDING").sort((a, b) => a.id - b.id)[0] ?? null;
}

export function alreadyRecorded(payments: ReadonlyArray<PendingCandidate>, captureId: string): boolean {
  return payments.some((p) => p.transactionId === captureId);
}

/** The pending payment this captured amount pays, or null when no amount matches. */
export function pendingForCapture<T extends PendingCandidate>(
  payments: ReadonlyArray<T>,
  capturedAmount: number
): T | null {
  return (
    [...payments]
      .filter((p) => p.status === "PENDING" && cents(p.paymentValue ?? 0) === cents(capturedAmount))
      .sort((a, b) => a.id - b.id)[0] ?? null
  );
}
