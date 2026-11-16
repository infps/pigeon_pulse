import { requirePermission } from "@/lib/authorize";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findReport } from "@/lib/reports/definitions";
import { renderPdf, renderReport, REPORT_FORMATS, type ReportFormat } from "@/lib/reports/render";
import type { ReportParams } from "@/lib/reports/types";

/**
 * Render one report in the requested format.
 *
 *   GET /api/admin/reports/race-result?raceId=221&format=pdf
 *   GET /api/admin/reports/breeder-balance?seasonId=11&format=xlsx
 *
 * HTML opens inline (for print preview); everything else downloads.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportKey: string }> }
) {
  try {
    const guard = await requirePermission("reports.view");
    if ("error" in guard) return guard.error;

    const { reportKey } = await params;
    const report = findReport(reportKey);
    if (!report) {
      return NextResponse.json({ message: `Unknown report "${reportKey}"` }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "pdf") as ReportFormat;
    if (!REPORT_FORMATS.includes(format)) {
      return NextResponse.json(
        { message: `Unsupported format "${format}". Use one of: ${REPORT_FORMATS.join(", ")}.` },
        { status: 400 }
      );
    }

    const reportParams = readParams(searchParams);

    if (report.requires && reportParams[report.requires] == null) {
      return NextResponse.json(
        { message: `${report.title} needs a ${report.requires} to run.` },
        { status: 400 }
      );
    }

    const data = await report.build(reportParams);
    const { body, contentType, extension } = await renderReport(
      data,
      format,
      report.isLabelSheet ?? false
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `${report.key}-${stamp}.${extension}`;
    const disposition = format === "html" ? "inline" : "attachment";

    return new NextResponse(body as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Email one breeder their copy of a report as a PDF, via Resend.
 *
 *   POST /api/admin/reports/breeder-balance?seasonId=11&breederId=42
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportKey: string }> }
) {
  try {
    const guard = await requirePermission("reports.view");
    if ("error" in guard) return guard.error;

    const { reportKey } = await params;
    const report = findReport(reportKey);
    if (!report?.perBreeder) {
      return NextResponse.json({ message: `"${reportKey}" can't be sent to a breeder` }, { status: 400 });
    }
    const reportParams = readParams(new URL(request.url).searchParams);
    if (reportParams.breederId == null || (report.requires && reportParams[report.requires] == null)) {
      return NextResponse.json({ message: `${report.title} needs a breeder and a ${report.requires}.` }, { status: 400 });
    }

    const breeder = await prisma.breeder.findUnique({
      where: { id: reportParams.breederId },
      select: { email: true, firstName: true },
    });
    const to = breeder?.email?.trim();
    if (!to) return NextResponse.json({ message: "This breeder has no email address." }, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REPORTS_FROM_EMAIL;
    if (!apiKey || !from) {
      return NextResponse.json({ message: "Email is not configured (RESEND_API_KEY / REPORTS_FROM_EMAIL)." }, { status: 503 });
    }

    const data = await report.build(reportParams);
    const pdf = await renderPdf(data, report.isLabelSheet ?? false);
    const stamp = new Date().toISOString().slice(0, 10);

    // ponytail: plain fetch to Resend's REST API, no SDK; lib/mail.ts once a second sender appears
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: [data.title, data.subtitle].filter(Boolean).join(" — "),
        text: `Hello ${breeder?.firstName?.trim() || "there"},\n\nYour ${data.title} report is attached.\n`,
        attachments: [
          { filename: `${report.key}-${stamp}.pdf`, content: pdf.toString("base64") },
        ],
      }),
    });
    if (!res.ok) {
      console.error("Resend send failed:", res.status, await res.text());
      return NextResponse.json({ message: "Email provider rejected the message." }, { status: 502 });
    }
    return NextResponse.json({ message: `Sent to ${to}` });
  } catch (error) {
    return failure(error);
  }
}

function readParams(searchParams: URLSearchParams): ReportParams {
  const numberParam = (name: string): number | undefined => {
    const raw = searchParams.get(name);
    if (raw == null || raw === "") return undefined;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  };
  return {
    seasonId: numberParam("seasonId"),
    raceId: numberParam("raceId"),
    breederId: numberParam("breederId"),
    feeSchemeId: numberParam("feeSchemeId"),
    prizeSchemeId: numberParam("prizeSchemeId"),
    bettingSchemeId: numberParam("bettingSchemeId"),
  };
}

// Missing-parameter and not-found problems are the operator's to fix, so
// surface the message rather than a generic 500.
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Failed to build report";
  const isUserError = /requires|not found/i.test(message);
  if (!isUserError) console.error("Report generation failed:", error);
  return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
}
