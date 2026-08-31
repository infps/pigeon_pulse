import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export interface BreederPreviewRow {
  rowIndex: number;
  status: "ok" | "error";
  message?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  cell?: string;
  sms?: string;
  address1?: string;
  city1?: string;
  state1?: string;
  zip1?: string;
}

function parseRows(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").trim()]));
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });

  const csv = await file.text();
  const rawRows = parseRows(csv);
  if (rawRows.length === 0) return NextResponse.json({ message: "CSV is empty or missing header" }, { status: 400 });

  const preview: BreederPreviewRow[] = rawRows.map((r, i) => {
    if (!r.first_name && !r.last_name) {
      return {
        rowIndex: i + 2,
        status: "error" as const,
        message: "first_name and last_name are both empty",
        firstName: "", lastName: "",
      };
    }
    return {
      rowIndex: i + 2,
      status: "ok" as const,
      firstName: r.first_name || "",
      lastName: r.last_name || "",
      email: r.email || undefined,
      phone: r.phone || undefined,
      cell: r.cell || undefined,
      sms: r.sms || undefined,
      address1: r.address1 || r.address || undefined,
      city1: r.city1 || r.city || undefined,
      state1: r.state1 || r.state || undefined,
      zip1: r.zip1 || r.zip || undefined,
    };
  });

  return NextResponse.json({ preview });
}
