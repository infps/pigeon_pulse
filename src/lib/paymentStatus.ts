export type PaymentStatus = "PAID" | "OVERPAID" | "PENDING" | "PARTIAL" | "NA";

export const VALID_PAYMENT_STATUS: ReadonlyArray<PaymentStatus> = [
    "PAID",
    "OVERPAID",
    "PENDING",
    "PARTIAL",
    "NA",
];

export interface PaymentStatusItem {
    entryFeeValue?: number | null;
    perchFeeValue?: number | null;
    raceFeeValue?: number | null;
    hotSpotFeeValue?: number | null;
}

export interface PaymentStatusPayment {
    paymentValue?: number | null;
    paymentDesc?: string | null;
    paymentType?: number | null;
}

export function computePaymentStatus(
    items: ReadonlyArray<PaymentStatusItem>,
    payments: ReadonlyArray<PaymentStatusPayment>
): PaymentStatus {
    const owed = items.reduce((s, i) => {
        return (
            s +
            (i.entryFeeValue ?? 0) +
            (i.perchFeeValue ?? 0) +
            (i.raceFeeValue ?? 0) +
            (i.hotSpotFeeValue ?? 0)
        );
    }, 0);
    const refundsOut = payments
        .filter((p) => p.paymentType === 3)
        .reduce((s, p) => s + Math.abs(p.paymentValue ?? 0), 0);
    const paid = payments
        .filter((p) => !p.paymentDesc?.toLowerCase().includes("bet stake") && p.paymentType !== 3)
        .reduce((s, p) => s + (p.paymentValue ?? 0), 0) - refundsOut;
    if (owed === 0) return "NA";
    if (paid > owed) return "OVERPAID";
    if (paid === owed && paid > 0) return "PAID";
    if (paid > 0 && paid < owed) return "PARTIAL";
    return "PENDING";
}
