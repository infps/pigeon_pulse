import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const ALL_FIELDS = [
  "breeder_name", "breeder_email", "bird_name",
  "band", "band1", "band2", "band3", "band4",
  "color", "sex", "rfid", "attention", "is_backup",
] as const;

type Field = typeof ALL_FIELDS[number];

function sexLabel(sex: number | null | undefined) {
  if (sex === 1) return "Cock";
  if (sex === 2) return "Hen";
  return "Unknown";
}

function escape(val: string | null | undefined) {
  const s = val ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

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

  const items = await prisma.eventInventoryItem.findMany({
    where: {
      eventInventory: { season: { eventId } },
    },
    include: {
      bird: true,
      eventInventory: { include: { breeder: true } },
    },
    orderBy: { id: "asc" },
  });

  const headerRow = fields.join(",");
  const rows = items.map((item) => {
    const b = item.bird;
    const breeder = item.eventInventory?.breeder;
    const breederName = [breeder?.firstName, breeder?.lastName].filter(Boolean).join(" ");

    const vals: Record<Field, string> = {
      breeder_name: breederName,
      breeder_email: breeder?.email || "",
      bird_name: b?.birdName || "",
      band: b?.band || [b?.band1, b?.band2, b?.band3, b?.band4].filter(Boolean).join("-"),
      band1: b?.band1 || "",
      band2: b?.band2 || "",
      band3: b?.band3 || "",
      band4: b?.band4 || "",
      color: b?.color || "",
      sex: sexLabel(b?.sex),
      rfid: b?.rfid || "",
      attention: b?.attention ? "true" : "false",
      is_backup: item.isBackup ? "true" : "false",
    };

    return fields.map((f) => escape(vals[f])).join(",");
  });

  const csv = [headerRow, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="birds-event-${eventId}.csv"`,
    },
  });
}
