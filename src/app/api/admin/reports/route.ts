import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { REPORTS } from "@/lib/reports/definitions";
import { REPORT_FORMATS } from "@/lib/reports/render";

/** Catalogue of available reports, for the admin Reports screen. */
export async function GET() {
  const guard = await requirePermission("reports.view");
    if ("error" in guard) return guard.error;
    const session = guard.session;

  return NextResponse.json({
    formats: REPORT_FORMATS,
    reports: REPORTS.map((r) => ({
      key: r.key,
      title: r.title,
      description: r.description,
      scope: r.scope,
      requires: r.requires,
      legacyTemplate: r.legacyTemplate,
      isLabelSheet: r.isLabelSheet ?? false,
    })),
  });
}
