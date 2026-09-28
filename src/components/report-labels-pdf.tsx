import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/reports/types";

/**
 * Mailing label sheet — replaces HayLoft's breeder_labels.fr3 and
 * address_book_labels.fr3, which printed physical address stickers.
 *
 * Laid out 3 across by 10 down on A4, which matches the common
 * 63.5 x 38.1 mm label stock those templates targeted.
 */

const COLUMNS = 3;
const ROWS_PER_PAGE = 10;
const PER_PAGE = COLUMNS * ROWS_PER_PAGE;

const styles = StyleSheet.create({
  page: { paddingVertical: 36, paddingHorizontal: 18, fontFamily: "Helvetica", color: "#1a1a1a" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  label: {
    width: `${100 / COLUMNS}%`,
    height: 72,
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  name: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 1.5 },
  line: { fontSize: 7.5, color: "#333", lineHeight: 1.35 },
  contact: { fontSize: 6.5, color: "#777", marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 18,
    right: 18,
    textAlign: "center",
    fontSize: 6.5,
    color: "#aaa",
  },
});

interface Label {
  name: string;
  address: string;
  cityState: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
}

function toLabels(data: ReportData): Label[] {
  return data.rows.map((r) => ({
    name: r[0] ?? "",
    address: r[1] ?? "",
    cityState: r[2] ?? "",
    zip: r[3] ?? "",
    country: r[4] ?? "",
    phone: r[5] ?? "",
    email: r[6] ?? "",
  }));
}

export function ReportLabelsPDF({ data }: { data: ReportData }) {
  const labels = toLabels(data);
  const pages: Label[][] = [];
  for (let i = 0; i < labels.length; i += PER_PAGE) {
    pages.push(labels.slice(i, i + PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <Document title={data.title}>
      {pages.map((pageLabels, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {pageLabels.map((label, i) => {
              const cityLine = [label.cityState, label.zip].filter(Boolean).join("  ");
              return (
                <View key={i} style={styles.label}>
                  <Text style={styles.name}>{label.name}</Text>
                  {label.address ? <Text style={styles.line}>{label.address}</Text> : null}
                  {cityLine ? <Text style={styles.line}>{cityLine}</Text> : null}
                  {label.country ? <Text style={styles.line}>{label.country}</Text> : null}
                  {label.phone ? <Text style={styles.contact}>{label.phone}</Text> : null}
                </View>
              );
            })}
          </View>
          <Text style={styles.footer}>
            {data.title} · {labels.length} labels · page {pageIndex + 1} of {pages.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
}
