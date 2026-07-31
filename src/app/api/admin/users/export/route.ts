import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const COLUMNS = [
  "First Name", "Last Name", "Email", "Phone", "Loft Name",
  "Country", "State", "City", "Address", "Postal Code", "Website",
  "Status", "Role", "Timezone", "Legal Name", "SSN", "Tax Number",
  "Note", "Created At",
];

function toRow(u: any): string[] {
  return [
    u.name ?? "",
    u.lastName ?? "",
    u.email ?? "",
    u.phoneNumber ?? "",
    u.loftName ?? "",
    u.country ?? "",
    u.state ?? "",
    u.city ?? "",
    u.address ?? "",
    u.postalCode ?? "",
    u.webAddress ?? "",
    u.status ?? "",
    u.role ?? "",
    u.timezone ?? "",
    u.legalName ?? "",
    u.ssn ?? "",
    u.taxNumber ?? "",
    u.note ?? "",
    u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
  ];
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const status = searchParams.get("status");
  const eventId = searchParams.get("eventId");

  const userSelect = {
    id: true, name: true, lastName: true, email: true, phoneNumber: true,
    loftName: true, country: true, state: true, city: true, address: true,
    postalCode: true, webAddress: true, status: true, role: true,
    timezone: true, legalName: true, ssn: true, taxNumber: true,
    note: true, createdAt: true,
  } as const;

  let users: any[] = [];

  if (eventId) {
    const eventIdInt = parseInt(eventId);
    const activeSeason = await prisma.season.findFirst({
      where: { eventId: eventIdInt, isActive: true },
      orderBy: { startDate: "desc" },
    });
    const inventories = await prisma.eventInventory.findMany({
      where: { seasonId: activeSeason?.id },
      include: { breeder: true },
    });
    const emails = inventories.map(i => i.breeder?.email).filter((e): e is string => !!e);
    const where: any = { email: { in: emails } };
    if (status && status !== "all") where.status = status;
    users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, select: userSelect });
  } else {
    const where: any = {};
    if (status && status !== "all") where.status = status;
    users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, select: userSelect });
  }

  const aoa = [COLUMNS, ...users.map(toRow)];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Breeders");

  if (format === "xlsx") {
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="breeders.xlsx"`,
      },
    });
  }

  const csv = XLSX.utils.sheet_to_csv(sheet);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="breeders.csv"`,
    },
  });
}
