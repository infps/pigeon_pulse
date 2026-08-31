import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const ALL_FIELDS = [
  "first_name", "last_name", "email", "phone", "cell", "sms",
  "address1", "city1", "state1", "zip1",
] as const;

type Field = typeof ALL_FIELDS[number];

function escape(val: string | null | undefined) {
  const s = val ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fieldsParam = url.searchParams.get("fields");
  const fields: Field[] = fieldsParam
    ? (fieldsParam.split(",").filter((f) => ALL_FIELDS.includes(f as Field)) as Field[])
    : [...ALL_FIELDS];

  if (fields.length === 0) return NextResponse.json({ message: "No valid fields specified" }, { status: 400 });

  const breeders = await prisma.breeder.findMany({
    orderBy: { lastName: "asc" },
    select: {
      firstName: true, lastName: true, email: true,
      phone: true, cell: true, sms: true,
      address1: true, city1: true, state1: true, zip1: true,
    },
  });

  const headerRow = fields.join(",");
  const rows = breeders.map((b) => {
    const vals: Record<Field, string> = {
      first_name: b.firstName || "",
      last_name: b.lastName || "",
      email: b.email || "",
      phone: b.phone || "",
      cell: b.cell || "",
      sms: b.sms || "",
      address1: b.address1 || "",
      city1: b.city1 || "",
      state1: b.state1 || "",
      zip1: b.zip1 || "",
    };
    return fields.map((f) => escape(vals[f])).join(",");
  });

  const csv = [headerRow, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="breeders.csv"`,
    },
  });
}
