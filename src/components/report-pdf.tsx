import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/reports/types";

/**
 * Printed report sheet — the replacement for HayLoft's FastReport output.
 *
 * Wide tables switch to landscape automatically, column widths are weighted by
 * content so a band number does not get the same room as a breeder name, and
 * the page footer carries a generation stamp for the paper trail.
 */

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 34, paddingHorizontal: 24, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 8, color: "#555", marginTop: 3 },
  rule: { borderBottomWidth: 1.5, borderBottomColor: "#1a1a1a", marginTop: 8, marginBottom: 8 },
  headerRow: { flexDirection: "row", backgroundColor: "#1f1f1f", paddingVertical: 4, paddingHorizontal: 3 },
  headerCell: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#ffffff" },
  row: { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: "#e3e3e3" },
  rowAlt: { backgroundColor: "#f6f6f4" },
  cell: { fontSize: 7.5 },
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderTopWidth: 1.2,
    borderTopColor: "#1a1a1a",
    backgroundColor: "#efefec",
  },
  totalsCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  empty: { fontSize: 9, color: "#777", marginTop: 16, fontFamily: "Helvetica-Oblique" },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: "#999",
  },
});

/** Weight columns by the longest value they carry, within sane bounds. */
function columnWidths(data: ReportData): string[] {
  const widths = data.columns.map((col, i) => {
    let longest = col.length;
    for (const row of data.rows) {
      const len = (row[i] ?? "").length;
      if (len > longest) longest = len;
    }
    return Math.min(Math.max(longest, 4), 34);
  });
  const total = widths.reduce((s, w) => s + w, 0) || 1;
  return widths.map((w) => `${(w / total) * 100}%`);
}

export function ReportPDF({ data }: { data: ReportData }) {
  const landscape = data.columns.length > 7;
  const widths = columnWidths(data);
  const generated = new Date().toLocaleString("en-US");

  return (
    <Document title={data.title}>
      <Page size="A4" orientation={landscape ? "landscape" : "portrait"} style={styles.page} wrap>
        <View>
          <Text style={styles.title}>{data.title}</Text>
          {data.subtitle ? <Text style={styles.subtitle}>{data.subtitle}</Text> : null}
        </View>
        <View style={styles.rule} />

        <View style={styles.headerRow} fixed>
          {data.columns.map((col, i) => (
            <Text key={col + i} style={[styles.headerCell, { width: widths[i] }]}>
              {col}
            </Text>
          ))}
        </View>

        {data.rows.length === 0 ? (
          <Text style={styles.empty}>No records matched this report.</Text>
        ) : (
          data.rows.map((row, r) => (
            <View key={r} style={r % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row} wrap={false}>
              {data.columns.map((_, c) => (
                <Text key={c} style={[styles.cell, { width: widths[c] }]}>
                  {row[c] ?? ""}
                </Text>
              ))}
            </View>
          ))
        )}

        {data.totals ? (
          <View style={styles.totalsRow} wrap={false}>
            {data.columns.map((_, c) => (
              <Text key={c} style={[styles.totalsCell, { width: widths[c] }]}>
                {data.totals?.[c] ?? ""}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {data.title} · {data.rows.length} rows · generated {generated}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
