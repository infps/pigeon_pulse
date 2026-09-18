import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { findReport } from "@/lib/reports/definitions";
import { renderReport, REPORT_FORMATS, type ReportFormat } from "@/lib/reports/render";
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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    const numberParam = (name: string): number | undefined => {
      const raw = searchParams.get(name);
      if (raw == null || raw === "") return undefined;
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    };

    const reportParams: ReportParams = {
      seasonId: numberParam("seasonId"),
      raceId: numberParam("raceId"),
      breederId: numberParam("breederId"),
      feeSchemeId: numberParam("feeSchemeId"),
      prizeSchemeId: numberParam("prizeSchemeId"),
      bettingSchemeId: numberParam("bettingSchemeId"),
    };

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
    // Missing-parameter and not-found problems are the operator's to fix, so
    // surface the message rather than a generic 500.
    const message = error instanceof Error ? error.message : "Failed to build report";
    const isUserError = /requires|not found/i.test(message);
    if (!isUserError) console.error("Report generation failed:", error);
    return NextResponse.json({ message }, { status: isUserError ? 400 : 500 });
  }
}
