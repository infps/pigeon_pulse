import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  getRegistrationRows,
  getResultsRows,
  getBasketsRows,
  getBirdsRows,
  getPaymentsRows,
  type ExportData,
} from "@/lib/exportFormats";
import { ExportTablePDF } from "@/components/export-table-pdf";
import { prisma } from "@/lib/prisma";

type Kind = "registrations" | "results" | "baskets" | "birds" | "payments";
type Format = "xlsx" | "csv" | "pdf" | "html";

const KINDS: readonly Kind[] = ["registrations", "results", "baskets", "birds", "payments"];
const FORMATS: readonly Format[] = ["xlsx", "csv", "pdf", "html"];

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(data: ExportData): string {
  const head = data.columns.map((c) => `<th>${htmlEscape(c)}</th>`).join("");
  const body = data.rows
    .map(
      (r) =>
        `<tr>${data.columns
          .map((_, i) => `<td>${htmlEscape(r[i] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(
    data.title,
  )}</title><style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}
    h1{font-size:20px;margin:0 0 4px}
    .meta{color:#666;font-size:12px;margin-bottom:16px}
    table{border-collapse:collapse;width:100%;font-size:13px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#1a1a1a;color:#fff}
    tr:nth-child(even) td{background:#f7f7f7}
  </style></head><body>
  <h1>${htmlEscape(data.title)}</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} &middot; ${data.rows.length} rows</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const allowedRoles = ["BREEDER", "ADMIN", "SUPERADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { kind: kindRaw } = await params;
  if (!KINDS.includes(kindRaw as Kind)) {
    return NextResponse.json({ message: "Invalid kind" }, { status: 400 });
  }
  const kind = kindRaw as Kind;

  const { searchParams } = new URL(request.url);
  const formatRaw = (searchParams.get("format") ?? "xlsx") as Format;
  if (!FORMATS.includes(formatRaw)) {
    return NextResponse.json({ message: "Invalid format" }, { status: 400 });
  }
  const format = formatRaw;
  const eventIdParam = searchParams.get("eventId");
  const raceIdParam = searchParams.get("raceId");
  const breederIdParam = searchParams.get("breederId");
  const eventId = eventIdParam ? parseInt(eventIdParam, 10) : undefined;
  const raceId = raceIdParam ? parseInt(raceIdParam, 10) : undefined;

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";

  let breederIdResolved: number;
  if (breederIdParam && isAdmin) {
    const target = await prisma.breeder.findUnique({
      where: { id: parseInt(breederIdParam, 10) },
    });
    if (!target) {
      return NextResponse.json({ message: "Breeder not found" }, { status: 404 });
    }
    breederIdResolved = target.id;
  } else {
    const breeder = await getOrCreateBreeder(
      session.user.id,
      session.user.email,
      session.user.name,
    );
    breederIdResolved = breeder.id;
  }

  let data: ExportData;
  switch (kind) {
    case "registrations":
      data = await getRegistrationRows(breederIdResolved, eventId);
      break;
    case "results":
      data = await getResultsRows(breederIdResolved, eventId, raceId);
      break;
    case "baskets":
      if (!eventId) {
        return NextResponse.json(
          { message: "eventId required for baskets export" },
          { status: 400 },
        );
      }
      data = await getBasketsRows(breederIdResolved, eventId);
      break;
    case "birds":
      data = await getBirdsRows(breederIdResolved);
      break;
    case "payments":
      data = await getPaymentsRows(breederIdResolved, eventId);
      break;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const baseName = `${kind}-${dateStr}`;

  if (format === "xlsx") {
    const sheet = XLSX.utils.aoa_to_sheet([data.columns, ...data.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, kind.slice(0, 31));
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    });
  }

  if (format === "csv") {
    const sheet = XLSX.utils.aoa_to_sheet([data.columns, ...data.rows]);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(ExportTablePDF, {
        columns: data.columns,
        rows: data.rows,
        title: data.title,
      }) as any,
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  }

  const html = renderHtml(data);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${baseName}.html"`,
    },
  });
}
