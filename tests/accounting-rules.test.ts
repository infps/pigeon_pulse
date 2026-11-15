/**
 * The accounting rules every screen shares. Run: bun test tests/
 *
 * Expected figures come from HayLoft: its stored procedures (PAYMENT_CALC,
 * EVENT_BET_TOTALS, EVENT_INVENTORY_ITEM_BET_CALC) and its AGN 2025 Details
 * screen. A change that breaks one of these changes what the books say.
 */
import { describe, expect, test } from "bun:test";
import {
  PAYMENT_TYPE,
  feesPaidNet,
  isOutgoing,
  paymentTypeFromKey,
  paymentTypeLabel,
  signedAmount,
} from "@/lib/payment-types";
import { betsActive, priceItemBets } from "@/lib/class-bets";
import { computePaymentTotals } from "@/lib/paymentStatus";
import { HOTSPOT_CASCADE } from "@/lib/fee-calculator";
import { alreadyRecorded, oldestPending, pendingForCapture } from "@/lib/paypal-capture";

describe("payment types are HayLoft's codes", () => {
  test("codes 0–8 match PAYMENT_CALC", () => {
    expect(PAYMENT_TYPE).toMatchObject({
      PERCH_FEE: 0, ENTRY_FEE: 1, BETS: 2, HOT_SPOT: 3, ENTRY_REFUND: 4,
      BETS_REFUND: 5, HOT_SPOT_REFUND: 6, TRANSFER_DUE: 7, WINNER_PAYOUT: 8,
    });
  });
  test("refunds and payouts are money out; hot spot (3) is money in", () => {
    for (const t of [4, 5, 6, 8]) expect(isOutgoing(t)).toBe(true);
    for (const t of [0, 1, 2, 3, 7, 9, 10]) expect(isOutgoing(t)).toBe(false);
  });
  test("money out is negative whatever sign it was written with", () => {
    expect(signedAmount({ paymentValue: 225, paymentType: 8 })).toBe(-225);
    expect(signedAmount({ paymentValue: -225, paymentType: 8 })).toBe(-225);
    expect(signedAmount({ paymentValue: 350, paymentType: 1 })).toBe(350);
    // HayLoft corrections: a negative fee payment keeps its sign.
    expect(signedAmount({ paymentValue: -40, paymentType: 0 })).toBe(-40);
  });
  test("unknown keys are refused, untyped rows read as registration", () => {
    expect(paymentTypeFromKey("PAYOUTS")).toBeNull();
    expect(paymentTypeFromKey("BIRD_FEE")).toBeNull();
    expect(paymentTypeFromKey("HOT_SPOT")).toBe(3);
    expect(paymentTypeLabel(null)).toBe("Registration");
    expect(paymentTypeLabel(3)).toBe("Hot spot fee");
  });
});

describe("fees paid", () => {
  const pay = (paymentType: number | null, paymentValue: number, status = "PAID") => ({ paymentType, paymentValue, status });
  test("fee payments in, fee refunds out; bets and payouts are separate money", () => {
    const net = feesPaidNet([
      pay(0, 500), pay(1, 350), pay(3, 200), pay(7, -100), // fees in (transfer due can be negative)
      pay(4, -350), pay(6, -50),                            // fee refunds out
      pay(2, 100), pay(5, -20), pay(8, -400),              // bets / payouts: not fees
      pay(1, 999, "PENDING"),                              // unpaid order
    ]);
    expect(net).toBe(500 + 350 + 200 - 100 - 350 - 50);
  });
});

describe("class bets (EVENT_INVENTORY_ITEM_BET_CALC / EVENT_BET_TOTALS)", () => {
  // AGN 2025's scheme "2025 AGN": Belgian 20/30/50, Standard 50, WTA 50, cut 15%.
  const scheme = { belgianShow1: 20, belgianShow2: 30, belgianShow3: 50, standardShow1: 50, wta1: 50, bettingCutPercent: 15 };
  test("each flag that is exactly 1 adds its class price", () => {
    expect(priceItemBets({ belgianShowBet1: 1, belgianShowBet3: 1, wtaBet1: 1 }, scheme)).toBe(120);
    expect(priceItemBets({ belgianShowBet1: 0, wtaBet1: null }, scheme)).toBe(0);
    expect(priceItemBets({ wtaBet1: 2 }, scheme)).toBe(0);
    expect(priceItemBets({ wtaBet1: 1 }, null)).toBe(0);
  });
  test("AGN 2025 flag counts give HayLoft's $16,460 and $2,469 commission", () => {
    const counts = { belgianShow1: 143, belgianShow2: 110, belgianShow3: 79, standardShow1: 59, wta1: 68 } as const;
    const total = Object.entries(counts).reduce((s, [k, n]) => s + n * (scheme as Record<string, number>)[k], 0);
    expect(total).toBe(16460);
    expect(total * scheme.bettingCutPercent / 100).toBe(2469);
  });
  test("refunded or replaced bets (IS_BET_ACTIVE = 0) do not count; unset counts", () => {
    expect(betsActive({ isBetActive: 0 })).toBe(false);
    expect(betsActive({ isBetActive: 1 })).toBe(true);
    expect(betsActive({ isBetActive: null })).toBe(true);
  });
});

describe("registration totals", () => {
  test("owed is net of bird refunds plus transfer charges; hot spot payments count", () => {
    const t = computePaymentTotals(
      [{ entryFeeValue: 350, perchFeeValue: 140, hotSpotFeeValue: 200, entryRefund: 350, transferDue: 25 }],
      [
        { paymentType: 1, paymentValue: 350, status: "PAID" },
        { paymentType: 0, paymentValue: 140, status: "PAID" },
        { paymentType: 3, paymentValue: 200, status: "PAID" }, // HayLoft hot spot: money in
        { paymentType: 4, paymentValue: -350, status: "PAID" }, // the refund paid back
        { paymentType: 7, paymentValue: 25, status: "PAID" },
        { paymentType: 2, paymentValue: 100, status: "PAID" }, // bets: not fees
      ]
    );
    expect(t.owed).toBe(350 + 140 + 200 - 350 + 25);
    expect(t.totalPaid).toBe(350 + 140 + 200 - 350 + 25);
    expect(t.balance).toBe(0);
    expect(t.status).toBe("PAID");
  });
  test("a paid hot spot gate balances exactly (neither owed twice nor paid twice)", () => {
    // Fees $1,000 + HS1 $200, both paid; HS1 settled in the mask.
    const t = computePaymentTotals(
      [{ entryFeeValue: 1000, hotSpot1FeeValue: 200 }],
      [
        { paymentType: 10, paymentValue: 1000, status: "PAID" },
        { paymentType: 3, paymentValue: 200, status: "PAID", hotspotGate: "HS1" },
      ],
      HOTSPOT_CASCADE === "SINGLE" ? 0b1111 : 0b0001
    );
    expect(t.balance).toBe(0);
    expect(t.status).toBe("PAID");
  });
});

describe("PayPal capture picks the right pending payment", () => {
  const rows = [
    { id: 12, status: "PENDING", paymentValue: 200, transactionId: null },
    { id: 10, status: "PENDING", paymentValue: 950, transactionId: null },
    { id: 11, status: "PAID", paymentValue: 950, transactionId: "CAP-1" },
  ];
  test("the order charges the oldest pending row", () => {
    expect(oldestPending(rows)?.id).toBe(10);
  });
  test("a capture marks the pending row with its exact amount, or none", () => {
    expect(pendingForCapture(rows, 200)?.id).toBe(12);
    expect(pendingForCapture(rows, 950.0)?.id).toBe(10);
    expect(pendingForCapture(rows, 199.99)).toBeNull();
  });
  test("a capture already recorded is recognised", () => {
    expect(alreadyRecorded(rows, "CAP-1")).toBe(true);
    expect(alreadyRecorded(rows, "CAP-2")).toBe(false);
  });
});
