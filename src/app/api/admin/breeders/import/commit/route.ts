import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { BreederPreviewRow } from "../preview/route";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { rows: BreederPreviewRow[] };
  const rows = body.rows?.filter((r) => r.status === "ok");
  if (!rows?.length) return NextResponse.json({ message: "No valid rows to import" }, { status: 400 });

  const results: { rowIndex: number; status: string; message: string; breederId?: number }[] = [];

  for (const row of rows) {
    try {
      const breeder = await prisma.breeder.create({
        data: {
          firstName: row.firstName || null,
          lastName: row.lastName || null,
          email: row.email || null,
          phone: row.phone || null,
          cell: row.cell || null,
          sms: row.sms || null,
          address1: row.address1 || null,
          city1: row.city1 || null,
          state1: row.state1 || null,
          zip1: row.zip1 || null,
          loginName: row.email || null,
          status: 1,
        },
      });
      results.push({ rowIndex: row.rowIndex, status: "created", message: "Breeder imported", breederId: breeder.id });
    } catch (err: any) {
      results.push({ rowIndex: row.rowIndex, status: "error", message: err?.message || "Unknown error" });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ results, summary: { created, failed } });
}
