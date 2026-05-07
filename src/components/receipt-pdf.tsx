import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const COLOR_BELGIAN = "#cfe7ff";
const COLOR_STANDARD = "#d3f2c8";
const COLOR_WTA = "#dcd3ff";
const COLOR_HEADER = "#2d3748";
const COLOR_BORDER = "#94a3b8";
const COLOR_GRID = "#cbd5e1";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  hLabel: { fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 10 },
  row: { flexDirection: "row" },
  thRow: { flexDirection: "row", backgroundColor: COLOR_HEADER },
  th: {
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    padding: 3,
    borderRightWidth: 0.5,
    borderRightColor: "#fff",
    textAlign: "center",
  },
  td: {
    fontSize: 7,
    padding: 2,
    borderRightWidth: 0.5,
    borderRightColor: COLOR_GRID,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_GRID,
    textAlign: "center",
  },
  tdLeft: { textAlign: "left" },
  tdRight: { textAlign: "right" },
  legendRow: { flexDirection: "row", marginTop: 4, gap: 6 },
  legendBox: { padding: 4, fontSize: 7, fontFamily: "Helvetica-Bold" },
  statusLegend: { marginTop: 4, fontSize: 7, color: "#475569" },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    backgroundColor: COLOR_HEADER,
    color: "#fff",
    padding: 4,
    marginTop: 8,
    marginBottom: 0,
  },
  balanceWrap: { marginTop: 10, alignSelf: "flex-end", width: 320 },
  balanceTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    backgroundColor: COLOR_HEADER,
    color: "#fff",
    padding: 4,
    textAlign: "center",
  },
  balSubTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#e2e8f0",
    padding: 3,
  },
  balRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR_GRID,
  },
  balCellLabel: { flex: 2, padding: 3, fontSize: 8 },
  balCell: { flex: 1, padding: 3, fontSize: 8, textAlign: "right" },
  balTotal: { fontFamily: "Helvetica-Bold", backgroundColor: "#f1f5f9" },
  finalBal: {
    flexDirection: "row",
    backgroundColor: COLOR_HEADER,
    color: "#fff",
    padding: 4,
    marginTop: 2,
  },
  finalBalLabel: { flex: 2, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 9 },
  finalBalVal: { flex: 1, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "right" },
});

const CLASS_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R"] as const;
const BELGIAN_IDX = new Set([0,1,2,3,4,5,6]);
const STANDARD_IDX = new Set([7,8,9,10,11,12]);

export interface ReceiptData {
  breederName: string;
  loftName: string;
  items: {
    band: string | null;
    entryFee: number;
    totalFee: number;
    statusCode: "L" | "A" | "";
    classes: { letter: string; marked: boolean; value: number }[];
  }[];
  classFeeLabels: { letter: string; fee: number }[];
  payments: { type: string; date: string | null; value: number; method: string; desc: string | null }[];
  fees: {
    perchDue: number; perchPaid: number;
    entryDue: number; entryPaid: number;
    hotSpotDue: number; hotSpotPaid: number;
    shippingDue: number; shippingPaid: number;
    classesDue: number; classesPaid: number;
  };
  refunds: {
    entryDue: number; entryPaid: number;
    hotSpotDue: number; hotSpotPaid: number;
    classesDue: number; classesPaid: number;
  };
  winner: {
    hotSpotEarned: number; hotSpotPaid: number;
    avgSpeedEarned: number; avgSpeedPaid: number;
    classesEarned: number; classesPaid: number;
    capitalEarned: number; capitalPaid: number;
    totalPayoutEarned: number; totalPayoutPaid: number;
  };
}

function fmtMoney(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `($${abs})` : `$${abs}`;
}

function classCellBg(idx: number): string {
  if (BELGIAN_IDX.has(idx)) return COLOR_BELGIAN;
  if (STANDARD_IDX.has(idx)) return COLOR_STANDARD;
  return COLOR_WTA;
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const STATUS_W = 14;
  const BAND_W = 70;
  const FEE_W = 44;
  const TOTAL_W = 50;
  const CLASS_W = 22;

  const totalDue =
    data.fees.perchDue + data.fees.entryDue + data.fees.hotSpotDue +
    data.fees.shippingDue + data.fees.classesDue;
  const totalPaid =
    data.fees.perchPaid + data.fees.entryPaid + data.fees.hotSpotPaid +
    data.fees.shippingPaid + data.fees.classesPaid;
  const totalRefDue =
    data.refunds.entryDue + data.refunds.hotSpotDue + data.refunds.classesDue;
  const totalRefPaid =
    data.refunds.entryPaid + data.refunds.hotSpotPaid + data.refunds.classesPaid;
  const finalBalance = totalDue - totalPaid + totalRefDue - data.winner.totalPayoutEarned;

  return (
    <Document>
      <Page size="LETTER" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text>
              <Text style={styles.hLabel}>Main breeder: </Text>
              {data.breederName}
            </Text>
            <Text>
              <Text style={styles.hLabel}>Loft: </Text>
              {data.loftName || "-"}
            </Text>
          </View>
        </View>

        {/* Bird/Classes table */}
        <View style={styles.section}>
          <View style={styles.thRow}>
            <Text style={[styles.th, { width: STATUS_W }]}> </Text>
            <Text style={[styles.th, { width: BAND_W, textAlign: "left" }]}>Band</Text>
            <Text style={[styles.th, { width: FEE_W }]}>Entry fee</Text>
            {data.classFeeLabels.map((c, i) => (
              <Text key={i} style={[styles.th, { width: CLASS_W, backgroundColor: classCellBg(i), color: "#0f172a" }]}>
                {c.letter}
                {"\n"}
                {c.fee > 0 ? `$${c.fee.toFixed(2)}` : ""}
              </Text>
            ))}
            <Text style={[styles.th, { width: TOTAL_W }]}>Total</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.td, { width: STATUS_W, fontFamily: "Helvetica-Bold" }]}>{item.statusCode}</Text>
              <Text style={[styles.td, styles.tdLeft, { width: BAND_W }]}>{item.band ?? "-"}</Text>
              <Text style={[styles.td, styles.tdRight, { width: FEE_W }]}>{fmtMoney(item.entryFee)}</Text>
              {item.classes.map((c, j) => (
                <Text key={j} style={[styles.td, { width: CLASS_W, backgroundColor: classCellBg(j) }]}>
                  {c.marked ? "X" : ""}
                </Text>
              ))}
              <Text style={[styles.td, styles.tdRight, { width: TOTAL_W, fontFamily: "Helvetica-Bold" }]}>
                {fmtMoney(item.totalFee)}
              </Text>
            </View>
          ))}

          <View style={styles.legendRow}>
            <Text style={[styles.legendBox, { backgroundColor: COLOR_BELGIAN }]}>
              Belgian show (10 to 1) - A,B,C,D,E,F,G
            </Text>
            <Text style={[styles.legendBox, { backgroundColor: COLOR_STANDARD }]}>
              Standard show (50-30-20) - H,I,J,K,L,M
            </Text>
            <Text style={[styles.legendBox, { backgroundColor: COLOR_WTA }]}>
              WTA - N,O,P,Q,R
            </Text>
          </View>
          <Text style={styles.statusLegend}>L - lost bird, A - active bet, empty - inactive bet</Text>
        </View>

        {/* Payments */}
        <Text style={styles.sectionTitle}>Payments</Text>
        <View style={styles.row}>
          <View style={{ flex: 1, borderWidth: 0.5, borderColor: COLOR_BORDER }}>
            <View style={styles.thRow}>
              <Text style={[styles.th, { flex: 2, textAlign: "left" }]}>Type</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Date</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Value</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Method</Text>
              <Text style={[styles.th, { flex: 2.5, textAlign: "left" }]}>Description</Text>
            </View>
            {data.payments.length === 0 ? (
              <Text style={{ padding: 6, fontSize: 8, color: "#64748b" }}>No payments recorded.</Text>
            ) : (
              data.payments.map((p, i) => (
                <View key={i} style={styles.row}>
                  <Text style={[styles.td, styles.tdLeft, { flex: 2 }]}>{p.type}</Text>
                  <Text style={[styles.td, { flex: 1.2 }]}>
                    {p.date ? new Date(p.date).toLocaleDateString() : "-"}
                  </Text>
                  <Text style={[styles.td, styles.tdRight, { flex: 1 }]}>{fmtMoney(p.value)}</Text>
                  <Text style={[styles.td, { flex: 1.2 }]}>{p.method}</Text>
                  <Text style={[styles.td, styles.tdLeft, { flex: 2.5 }]}>{p.desc ?? ""}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Balance breakdown */}
        <View style={styles.balanceWrap}>
          <Text style={styles.balanceTitle}>BREEDER BALANCE TOTAL</Text>

          <Text style={styles.balSubTitle}>FEES</Text>
          <View style={styles.balRow}>
            <Text style={styles.balCellLabel}> </Text>
            <Text style={[styles.balCell, { fontFamily: "Helvetica-Bold" }]}>DUE</Text>
            <Text style={[styles.balCell, { fontFamily: "Helvetica-Bold" }]}>PAID</Text>
          </View>
          <BalRow label="Perch Fee" due={data.fees.perchDue} paid={data.fees.perchPaid} />
          <BalRow label="Entry Fee" due={data.fees.entryDue} paid={data.fees.entryPaid} />
          <BalRow label="Hot Spot" due={data.fees.hotSpotDue} paid={data.fees.hotSpotPaid} />
          <BalRow label="Shipping Fee" due={data.fees.shippingDue} paid={data.fees.shippingPaid} />
          <BalRow label="Classes" due={data.fees.classesDue} paid={data.fees.classesPaid} />
          <BalRow label="TOTAL FEES" due={totalDue} paid={totalPaid} bold />

          <Text style={styles.balSubTitle}>REFUNDS</Text>
          <View style={styles.balRow}>
            <Text style={styles.balCellLabel}> </Text>
            <Text style={[styles.balCell, { fontFamily: "Helvetica-Bold" }]}>DUE</Text>
            <Text style={[styles.balCell, { fontFamily: "Helvetica-Bold" }]}>PAID</Text>
          </View>
          <BalRow label="Entry Fee" due={data.refunds.entryDue} paid={data.refunds.entryPaid} />
          <BalRow label="Hot Spot" due={data.refunds.hotSpotDue} paid={data.refunds.hotSpotPaid} />
          <BalRow label="Classes" due={data.refunds.classesDue} paid={data.refunds.classesPaid} />
          <BalRow label="TOTAL REFUNDS" due={totalRefDue} paid={totalRefPaid} bold />

          <Text style={styles.balSubTitle}>WINNER PRIZE PAYOUT</Text>
          <View style={styles.balRow}>
            <Text style={styles.balCellLabel}> </Text>
            <Text style={[styles.balCell, { fontFamily: "Helvetica-Bold" }]}>EARNED</Text>
            <Text style={[styles.balCell, { fontFamily: "Helvetica-Bold" }]}>PAID</Text>
          </View>
          <BalRow label="Hot Spot" due={data.winner.hotSpotEarned} paid={data.winner.hotSpotPaid} />
          <BalRow label="Average Speed" due={data.winner.avgSpeedEarned} paid={data.winner.avgSpeedPaid} />
          <BalRow label="Classes" due={data.winner.classesEarned} paid={data.winner.classesPaid} />
          <BalRow label="Capital Prize" due={data.winner.capitalEarned} paid={data.winner.capitalPaid} />
          <BalRow label="Total Payout" due={data.winner.totalPayoutEarned} paid={data.winner.totalPayoutPaid} bold />

          <View style={styles.finalBal}>
            <Text style={styles.finalBalLabel}>BALANCE</Text>
            <Text style={styles.finalBalVal}>{fmtMoney(finalBalance)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function BalRow({ label, due, paid, bold }: { label: string; due: number; paid: number; bold?: boolean }) {
  const rowStyle = bold ? [styles.balRow, styles.balTotal] : [styles.balRow];
  const txt = bold ? { fontFamily: "Helvetica-Bold" as const } : {};
  return (
    <View style={rowStyle}>
      <Text style={[styles.balCellLabel, txt]}>{label}</Text>
      <Text style={[styles.balCell, txt]}>{fmtMoney(due)}</Text>
      <Text style={[styles.balCell, txt]}>{fmtMoney(paid)}</Text>
    </View>
  );
}

export const CLASS_LETTER_LIST = CLASS_LETTERS;
