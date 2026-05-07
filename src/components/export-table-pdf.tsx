import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 8, color: "#666", marginBottom: 12 },
  table: { borderWidth: 1, borderColor: "#cfcfcf" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    padding: 4,
  },
  row: {
    flexDirection: "row",
    padding: 3,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  rowAlt: {
    flexDirection: "row",
    padding: 3,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#f7f7f7",
  },
  headerCell: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#fff" },
  cell: { fontSize: 8 },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 24,
    right: 24,
    textAlign: "center",
    fontSize: 7,
    color: "#999",
  },
});

export interface ExportTablePDFProps {
  columns: string[];
  rows: string[][];
  title: string;
}

export function ExportTablePDF({ columns, rows, title }: ExportTablePDFProps) {
  const colCount = columns.length || 1;
  const colWidth = `${100 / colCount}%`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          Generated {new Date().toLocaleString()} - {rows.length} rows
        </Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            {columns.map((c, i) => (
              <Text key={i} style={[styles.headerCell, { width: colWidth }]}>
                {c}
              </Text>
            ))}
          </View>
          {rows.map((r, ri) => (
            <View key={ri} style={ri % 2 === 0 ? styles.row : styles.rowAlt}>
              {columns.map((_, ci) => (
                <Text key={ci} style={[styles.cell, { width: colWidth }]}>
                  {r[ci] ?? ""}
                </Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.footer}>Pigeon Pulse Export</Text>
      </Page>
    </Document>
  );
}
