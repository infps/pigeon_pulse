import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, borderBottomWidth: 2, borderBottomColor: "#1a1a1a", paddingBottom: 8 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 11, color: "#444" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", backgroundColor: "#f0f0f0", padding: 4, marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 90, color: "#555" },
  value: { flex: 1, fontFamily: "Helvetica-Bold" },
  table: { marginTop: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1a1a1a", color: "#fff", padding: "4 6" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e0e0e0", padding: "3 6" },
  tableRowAlt: { flexDirection: "row", backgroundColor: "#f9f9f9", borderBottomWidth: 1, borderBottomColor: "#e0e0e0", padding: "3 6" },
  col: { flex: 1 },
  colN: { width: 24 },
  colFee: { width: 60, textAlign: "right" },
  colDate: { width: 72 },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, gap: 16 },
  totalItem: { alignItems: "flex-end" },
  totalLabel: { fontSize: 9, color: "#555" },
  totalValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, textAlign: "center", fontSize: 8, color: "#999" },
  headerCell: { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 9 },
  cell: { fontSize: 9 },
});

export interface ReceiptData {
  eventName: string;
  eventDate: string | null;
  breederName: string;
  breederEmail: string;
  breederPhone: string;
  loftName: string;
  birds: {
    birdNo: number | null;
    band: string | null;
    birdName: string | null;
    color: string | null;
    sex: string | number | null;
    totalFee: number;
  }[];
  payments: {
    date: string | null;
    type: string;
    method: string;
    amount: number;
  }[];
  totalOwed: number;
  totalPaid: number;
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const balance = data.totalOwed - data.totalPaid;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{data.eventName}</Text>
            <Text style={styles.subtitle}>BIRD SUBMISSION RECEIPT</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {data.eventDate && <Text>{new Date(data.eventDate).toLocaleDateString()}</Text>}
          </View>
        </View>

        {/* Breeder Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BREEDER INFORMATION</Text>
          <View style={{ flexDirection: "row", gap: 32 }}>
            <View>
              <View style={styles.row}><Text style={styles.label}>Name:</Text><Text style={styles.value}>{data.breederName}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Email:</Text><Text style={styles.value}>{data.breederEmail || "—"}</Text></View>
            </View>
            <View>
              <View style={styles.row}><Text style={styles.label}>Phone:</Text><Text style={styles.value}>{data.breederPhone || "—"}</Text></View>
              <View style={styles.row}><Text style={styles.label}>Loft:</Text><Text style={styles.value}>{data.loftName || "—"}</Text></View>
            </View>
          </View>
        </View>

        {/* Birds */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BIRDS SUBMITTED ({data.birds.length})</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colN, styles.headerCell]}>#</Text>
              <Text style={[styles.col, styles.headerCell]}>Band</Text>
              <Text style={[styles.col, styles.headerCell]}>Name</Text>
              <Text style={[styles.col, styles.headerCell]}>Color</Text>
              <Text style={[styles.col, styles.headerCell]}>Sex</Text>
              <Text style={[styles.colFee, styles.headerCell]}>Total Fee</Text>
            </View>
            {data.birds.map((b, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.colN, styles.cell]}>{b.birdNo ?? i + 1}</Text>
                <Text style={[styles.col, styles.cell]}>{b.band || "—"}</Text>
                <Text style={[styles.col, styles.cell]}>{b.birdName || "—"}</Text>
                <Text style={[styles.col, styles.cell]}>{b.color || "—"}</Text>
                <Text style={[styles.col, styles.cell]}>{b.sex != null ? String(b.sex) : "—"}</Text>
                <Text style={[styles.colFee, styles.cell]}>${b.totalFee.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Payments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENTS</Text>
          {data.payments.length === 0 ? (
            <Text style={{ color: "#888", fontSize: 9 }}>No payments recorded.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colDate, styles.headerCell]}>Date</Text>
                <Text style={[styles.col, styles.headerCell]}>Type</Text>
                <Text style={[styles.col, styles.headerCell]}>Method</Text>
                <Text style={[styles.colFee, styles.headerCell]}>Amount</Text>
              </View>
              {data.payments.map((p, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.colDate, styles.cell]}>{p.date ? new Date(p.date).toLocaleDateString() : "—"}</Text>
                  <Text style={[styles.col, styles.cell]}>{p.type}</Text>
                  <Text style={[styles.col, styles.cell]}>{p.method}</Text>
                  <Text style={[styles.colFee, styles.cell]}>${p.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Total Fees</Text>
            <Text style={styles.totalValue}>${data.totalOwed.toFixed(2)}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={[styles.totalValue, { color: "#16a34a" }]}>${data.totalPaid.toFixed(2)}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Balance Due</Text>
            <Text style={[styles.totalValue, { color: balance > 0 ? "#dc2626" : "#16a34a" }]}>${balance.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>Generated {new Date().toLocaleString()} · {data.eventName}</Text>
      </Page>
    </Document>
  );
}
