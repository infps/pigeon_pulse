import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { REPORTS } from "@/lib/reports/definitions";
import { REPORT_FORMATS } from "@/lib/reports/render";

/** Catalogue of available reports, for the admin Reports screen. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

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
