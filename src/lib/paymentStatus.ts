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
    bird?: { rfid?: string | null } | null;
}

export interface PaymentStatusPayment {
    paymentValue?: number | null;
}

export function computePaymentStatus(
    items: ReadonlyArray<PaymentStatusItem>,
    payments: ReadonlyArray<PaymentStatusPayment>
): PaymentStatus {
    const owed = items.reduce((s, i) => {
        const scanned = !!i.bird?.rfid;
        if (!scanned) return s;
        return (
            s +
            (i.entryFeeValue ?? 0) +
            (i.perchFeeValue ?? 0) +
            (i.raceFeeValue ?? 0) +
            (i.hotSpotFeeValue ?? 0)
        );
    }, 0);
    const paid = payments.reduce((s, p) => s + (p.paymentValue ?? 0), 0);
    if (owed === 0) return "NA";
    if (paid > owed) return "OVERPAID";
    if (paid === owed && paid > 0) return "PAID";
    if (paid > 0 && paid < owed) return "PARTIAL";
    return "PENDING";
}
