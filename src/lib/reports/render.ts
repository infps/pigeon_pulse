import * as XLSX from "xlsx";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPDF } from "@/components/report-pdf";
import { ReportLabelsPDF } from "@/components/report-labels-pdf";
import type { ReportData } from "./types";

export type ReportFormat = "csv" | "xlsx" | "pdf" | "html";

export const REPORT_FORMATS: readonly ReportFormat[] = ["csv", "xlsx", "pdf", "html"];

export const CONTENT_TYPES: Record<ReportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rows plus an optional totals line, as a sheet-ready matrix. */
function toMatrix(data: ReportData): string[][] {
  const matrix = [data.columns, ...data.rows];
  if (data.totals) matrix.push(data.totals);
  return matrix;
}

export function renderCsv(data: ReportData): string {
  const sheet = XLSX.utils.aoa_to_sheet(toMatrix(data));
  return XLSX.utils.sheet_to_csv(sheet);
}

export function renderXlsx(data: ReportData): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(toMatrix(data));

  // Size columns to their content so the sheet is readable without fiddling.
  sheet["!cols"] = data.columns.map((col, i) => {
    let width = col.length;
    for (const row of data.rows) {
      const len = (row[i] ?? "").length;
      if (len > width) width = len;
    }
    return { wch: Math.min(Math.max(width + 2, 8), 40) };
  });
  sheet["!freeze"] = { xSplit: "0", ySplit: "1" };

  const wb = XLSX.utils.book_new();
  // Excel rejects sheet names over 31 chars or containing []:*?/\
  const sheetName = data.title.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Report";
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function renderHtml(data: ReportData): string {
  const head = data.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = data.rows
    .map(
      (r) =>
        `<tr>${data.columns.map((_, i) => `<td>${escapeHtml(r[i] ?? "")}</td>`).join("")}</tr>`
    )
    .join("");
  const totals = data.totals
    ? `<tfoot><tr>${data.columns
        .map((_, i) => `<th>${escapeHtml(data.totals?.[i] ?? "")}</th>`)
        .join("")}</tr></tfoot>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    data.title
  )}</title><style>
    body{font-family:system-ui,-apple-system,sans-serif;padding:28px;color:#1a1a1a;background:#fff}
    h1{font-size:20px;margin:0 0 4px}
    .meta{color:#666;font-size:12px;margin-bottom:18px}
    table{border-collapse:collapse;width:100%;font-size:12.5px}
    th,td{border:1px solid #ddd;padding:5px 8px;text-align:left;white-space:nowrap}
    thead th{background:#1f1f1f;color:#fff;position:sticky;top:0}
    tbody tr:nth-child(even) td{background:#f7f7f5}
    tfoot th{background:#efefec;border-top:2px solid #1a1a1a}
    @media print{body{padding:0}thead th{position:static}}
  </style></head><body>
  <h1>${escapeHtml(data.title)}</h1>
  <div class="meta">${escapeHtml(data.subtitle ?? "")}${data.subtitle ? " &middot; " : ""}${
    data.rows.length
  } rows &middot; generated ${new Date().toLocaleString("en-US")}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${totals}</table>
  </body></html>`;
}

export async function renderPdf(data: ReportData, asLabels: boolean): Promise<Buffer> {
  const element = asLabels
    ? React.createElement(ReportLabelsPDF, { data })
    : React.createElement(ReportPDF, { data });
  // renderToBuffer's types expect its own DocumentProps shape; the component
  // returns exactly that at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}

export async function renderReport(
  data: ReportData,
  format: ReportFormat,
  asLabels = false
): Promise<{ body: string | Uint8Array; contentType: string; extension: string }> {
  switch (format) {
    case "csv":
      return { body: renderCsv(data), contentType: CONTENT_TYPES.csv, extension: "csv" };
    case "xlsx":
      return {
        body: new Uint8Array(renderXlsx(data)),
        contentType: CONTENT_TYPES.xlsx,
        extension: "xlsx",
      };
    case "pdf":
      return {
        body: new Uint8Array(await renderPdf(data, asLabels)),
        contentType: CONTENT_TYPES.pdf,
        extension: "pdf",
      };
    case "html":
      return { body: renderHtml(data), contentType: CONTENT_TYPES.html, extension: "html" };
  }
}
