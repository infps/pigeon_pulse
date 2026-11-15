import { prisma } from "@/lib/prisma";
import type { ReceiptData } from "@/components/receipt-pdf";
import { PAYMENT_TYPE, paymentTypeLabel, signedAmount } from "@/lib/payment-types";
import { priceItemBets, type BettingPrices } from "@/lib/class-bets";

const METHOD_LABELS: Record<number, string> = {
  0: "Cash",
  1: "Credit Card",
  2: "PayPal",
  3: "Bank Transfer",
};

type BetField =
  | "belgianShowBet1" | "belgianShowBet2" | "belgianShowBet3"
  | "belgianShowBet4" | "belgianShowBet5" | "belgianShowBet6" | "belgianShowBet7"
  | "standardShowBet1" | "standardShowBet2" | "standardShowBet3"
  | "standardShowBet4" | "standardShowBet5" | "standardShowBet6"
  | "wtaBet1" | "wtaBet2" | "wtaBet3" | "wtaBet4" | "wtaBet5";

const BET_FIELDS: BetField[] = [
  "belgianShowBet1","belgianShowBet2","belgianShowBet3","belgianShowBet4",
  "belgianShowBet5","belgianShowBet6","belgianShowBet7",
  "standardShowBet1","standardShowBet2","standardShowBet3",
  "standardShowBet4","standardShowBet5","standardShowBet6",
  "wtaBet1","wtaBet2","wtaBet3","wtaBet4","wtaBet5",
];
const CLASS_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R"];

const SCHEME_FIELD_MAP: Record<BetField, string> = {
  belgianShowBet1: "belgianShow1", belgianShowBet2: "belgianShow2",
  belgianShowBet3: "belgianShow3", belgianShowBet4: "belgianShow4",
  belgianShowBet5: "belgianShow5", belgianShowBet6: "belgianShow6",
  belgianShowBet7: "belgianShow7",
  standardShowBet1: "standardShow1", standardShowBet2: "standardShow2",
  standardShowBet3: "standardShow3", standardShowBet4: "standardShow4",
  standardShowBet5: "standardShow5", standardShowBet6: "standardShow6",
  wtaBet1: "wta1", wtaBet2: "wta2", wtaBet3: "wta3", wtaBet4: "wta4", wtaBet5: "wta5",
};

export async function buildReceiptData(inventoryId: number): Promise<ReceiptData | null> {
  const inv = await prisma.eventInventory.findUnique({
    where: { id: inventoryId },
    include: {
      breeder: true,
      season: { include: { event: true, bettingScheme: true } },
      items: {
        include: {
          bird: true,
          raceItems: {
            include: {
              result: true,
              bets: { select: { id: true, amount: true, payoutValue: true, status: true, bettorId: true } },
            },
          },
        },
      },
      payments: true,
    },
  });
  if (!inv) return null;

  const breederLast = inv.breeder?.lastName ?? "";
  const breederFirst = inv.breeder?.firstName ?? "";
  const breederNumber = inv.breeder?.number ?? inv.breeder?.id ?? "";
  const breederName = `${breederLast},${breederFirst} (${breederNumber})`;

  const scheme = inv.season?.bettingScheme as Record<string, unknown> | null | undefined;
  const classFeeLabels = BET_FIELDS.map((f, i) => {
    const raw = scheme ? (scheme[SCHEME_FIELD_MAP[f]] as number | null | undefined) : 0;
    return { letter: CLASS_LETTERS[i], fee: Number(raw ?? 0) };
  });

  // A deleted entry is not listed or billed; what it earned stays (see below).
  const itemsList = (inv.items ?? []).filter((it) => it.deletedAt == null);

  const items = itemsList.map((item) => {
    // Class bets in dollars: each flag priced by the season's betting scheme
    // (HayLoft EVENT_INVENTORY_ITEM_BET_CALC). The flags themselves are 1s.
    const betsSum = priceItemBets(item, inv.season?.bettingScheme as BettingPrices | null);
    const total =
      Number(item.entryFeeValue ?? 0) +
      Number(item.perchFeeValue ?? 0) +
      Number(item.raceFeeValue ?? 0) +
      Number(item.hotSpotFeeValue ?? 0) +
      betsSum;
    const isLost = item.bird?.isLost === 1;
    const isActive = Number(item.isBetActive ?? 0) > 0;
    const statusCode: "L" | "A" | "" = isLost ? "L" : isActive ? "A" : "";
    return {
      band: item.bird?.band ?? null,
      entryFee: Number(item.entryFeeValue ?? 0),
      totalFee: total,
      statusCode,
      classes: BET_FIELDS.map((f, idx) => {
        const v = Number(item[f] ?? 0);
        return { letter: CLASS_LETTERS[idx], marked: v > 0, value: v };
      }),
    };
  });

  const sumItems = (fn: (it: (typeof itemsList)[number]) => number) =>
    itemsList.reduce((s, it) => s + fn(it), 0);
  // Only PAID rows are money received.
  const sumPayments = (typeId: number) =>
    (inv.payments ?? [])
      .filter((p) => p.paymentType === typeId && p.status === "PAID")
      .reduce((s, p) => s + Number(p.paymentValue ?? 0), 0);

  // HayLoft: perch fee = PERCH_FEE_VALUE, paid by type 0; entry fee =
  // ENTRY_FEE_VALUE, paid by type 1; hot spot paid by type 3; classes by type 2.
  const fees = {
    perchDue: sumItems((i) => Number(i.perchFeeValue ?? 0)),
    perchPaid: sumPayments(PAYMENT_TYPE.PERCH_FEE),
    entryDue: sumItems((i) => Number(i.entryFeeValue ?? 0)),
    entryPaid: sumPayments(PAYMENT_TYPE.ENTRY_FEE),
    hotSpotDue: sumItems((i) => Number(i.hotSpotFeeValue ?? 0)),
    hotSpotPaid: sumPayments(PAYMENT_TYPE.HOT_SPOT),
    shippingDue: 0,
    shippingPaid: 0,
    classesDue: sumItems((i) => priceItemBets(i, inv.season?.bettingScheme as BettingPrices | null)),
    classesPaid: sumPayments(PAYMENT_TYPE.BETS),
  };

  const refunds = {
    entryDue: sumItems((i) => Number(i.entryRefund ?? 0)),
    entryPaid: 0,
    hotSpotDue: sumItems((i) => Number(i.hotSpotRefund ?? 0)),
    hotSpotPaid: 0,
    classesDue: sumItems((i) => Number(i.betsRefund ?? 0)),
    classesPaid: 0,
  };

  // classesEarned: sum of won/refunded bet payouts where this breeder's user is the bettor
  const breederUserId = inv.breeder?.userId ?? null;
  const classesEarned = (inv.items ?? []).reduce((s, it) => {
    return s + (it.raceItems ?? []).reduce((rs, raceItem) => {
      return rs + (raceItem.bets ?? []).reduce((bs, bet) => {
        if (
          breederUserId &&
          bet.bettorId === breederUserId &&
          (bet.status === "WON" || bet.status === "REFUNDED") &&
          bet.payoutValue
        ) {
          return bs + Number(bet.payoutValue);
        }
        return bs;
      }, 0);
    }, 0);
  }, 0);

  // Capital/hotspot prizes remain from RaceItemResult.prizeValue (non-betting race prizes)
  const totalEarned = (inv.items ?? []).reduce((s, it) => {
    return s + (it.raceItems ?? []).reduce((rs, r) => rs + Number(r.result?.prizeValue ?? 0), 0);
  }, 0);

  const winner = {
    hotSpotEarned: 0, hotSpotPaid: 0,
    avgSpeedEarned: 0, avgSpeedPaid: 0,
    classesEarned,
    classesPaid: sumPayments(2),
    capitalEarned: totalEarned,
    capitalPaid: 0,
    totalPayoutEarned: totalEarned + classesEarned,
    totalPayoutPaid: sumPayments(3),
  };

  return {
    breederName,
    loftName: inv.loft ?? "",
    items,
    classFeeLabels,
    payments: (inv.payments ?? []).map((p) => {
      return {
        type: paymentTypeLabel(p.paymentType),
        date: p.paymentDate?.toISOString() ?? null,
        value: signedAmount(p),
        method: typeof p.paymentMethod === "number" ? (METHOD_LABELS[p.paymentMethod] ?? "Other") : "Other",
        desc: p.paymentDesc ?? null,
      };
    }),
    fees,
    refunds,
    winner,
  };
}

export async function getBreederLastName(inventoryId: number): Promise<string> {
  const inv = await prisma.eventInventory.findUnique({
    where: { id: inventoryId },
    include: { breeder: true },
  });
  return inv?.breeder?.lastName ?? "breeder";
}
