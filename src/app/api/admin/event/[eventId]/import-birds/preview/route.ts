import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type RowStatus = "ok" | "skip_duplicate_band" | "error";

export interface BirdPreviewRow {
  rowIndex: number;
  status: RowStatus;
  message?: string;
  breederAction: "existing_email" | "existing_name" | "create" | null;
  breederName: string;
  breederId?: number;
  band: string;
  birdName: string;
  color: string;
  sex: number;
  rfid?: string;
  attention: boolean;
  // raw parsed fields kept for commit
  band1: string;
  band2: string;
  band3: string;
  band4: string;
  breederEmail?: string;
  breederFirstName?: string;
  breederLastName?: string;
}

function parseSex(raw: string): number {
  const s = raw.trim().toLowerCase();
  if (s === "1" || s === "cock" || s === "male" || s === "m") return 1;
  if (s === "2" || s === "hen" || s === "female" || s === "f") return 2;
  return 0;
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

export async function POST(
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });

  const csv = await file.text();
  const rawRows = parseRows(csv);
  if (rawRows.length === 0) return NextResponse.json({ message: "CSV is empty or missing header" }, { status: 400 });

  // Collect emails + name pairs for bulk lookup
  const emails = rawRows.map((r) => r.breeder_email).filter(Boolean);
  const existingByEmail = await prisma.breeder.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const emailMap = new Map(existingByEmail.map((b) => [b.email?.toLowerCase(), b]));

  // Collect bands for duplicate check
  const bands = rawRows
    .filter((r) => r.band1 && r.band2 && r.band3 && r.band4)
    .map((r) => `${r.band1}-${r.band2}-${r.band3}-${r.band4}`);
  const existingBands = await prisma.bird.findMany({
    where: { band: { in: bands } },
    select: { band: true },
  });
  const dupBands = new Set(existingBands.map((b) => b.band));

  const preview: BirdPreviewRow[] = await Promise.all(
    rawRows.map(async (r, i) => {
      const band1 = r.band1 || "";
      const band2 = r.band2 || "";
      const band3 = r.band3 || "";
      const band4 = r.band4 || "";
      const band = `${band1}-${band2}-${band3}-${band4}`;

      if (!band1 || !band2 || !band3 || !band4) {
        return {
          rowIndex: i + 2,
          status: "error" as RowStatus,
          message: "Missing band fields",
          breederAction: null,
          breederName: "",
          band,
          birdName: r.bird_name || "",
          color: r.color || "",
          sex: parseSex(r.sex || ""),
          rfid: r.rfid || undefined,
          attention: r.attention === "true" || r.attention === "1",
          band1, band2, band3, band4,
          breederEmail: r.breeder_email || undefined,
          breederFirstName: r.breeder_first_name || undefined,
          breederLastName: r.breeder_last_name || undefined,
        };
      }

      if (dupBands.has(band)) {
        return {
          rowIndex: i + 2,
          status: "skip_duplicate_band" as RowStatus,
          message: `Band ${band} already exists`,
          breederAction: null,
          breederName: [r.breeder_first_name, r.breeder_last_name].filter(Boolean).join(" "),
          band,
          birdName: r.bird_name || "",
          color: r.color || "",
          sex: parseSex(r.sex || ""),
          rfid: r.rfid || undefined,
          attention: r.attention === "true" || r.attention === "1",
          band1, band2, band3, band4,
          breederEmail: r.breeder_email || undefined,
          breederFirstName: r.breeder_first_name || undefined,
          breederLastName: r.breeder_last_name || undefined,
        };
      }

      // Breeder resolution (preview only — no writes)
      let breederAction: BirdPreviewRow["breederAction"] = "create";
      let breederId: number | undefined;
      let breederName = [r.breeder_first_name, r.breeder_last_name].filter(Boolean).join(" ");

      const emailKey = r.breeder_email?.toLowerCase();
      if (emailKey && emailMap.has(emailKey)) {
        const existing = emailMap.get(emailKey)!;
        const existingName = [existing.firstName, existing.lastName].filter(Boolean).join(" ").toLowerCase();
        const csvName = breederName.toLowerCase();
        // If name differs → treat as separate individual (new breeder)
        if (existingName && csvName && existingName !== csvName) {
          breederAction = "create";
        } else {
          breederAction = "existing_email";
          breederId = existing.id;
          breederName = [existing.firstName, existing.lastName].filter(Boolean).join(" ");
        }
      } else if (r.breeder_first_name || r.breeder_last_name) {
        // Try name match
        const byName = await prisma.breeder.findFirst({
          where: {
            firstName: r.breeder_first_name || null,
            lastName: r.breeder_last_name || null,
          },
          select: { id: true, firstName: true, lastName: true },
        });
        if (byName) {
          breederAction = "existing_name";
          breederId = byName.id;
          breederName = [byName.firstName, byName.lastName].filter(Boolean).join(" ");
        }
      }

      return {
        rowIndex: i + 2,
        status: "ok" as RowStatus,
        breederAction,
        breederId,
        breederName,
        band,
        birdName: r.bird_name || "",
        color: r.color || "",
        sex: parseSex(r.sex || ""),
        rfid: r.rfid || undefined,
        attention: r.attention === "true" || r.attention === "1",
        band1, band2, band3, band4,
        breederEmail: r.breeder_email || undefined,
        breederFirstName: r.breeder_first_name || undefined,
        breederLastName: r.breeder_last_name || undefined,
      };
    })
  );

  return NextResponse.json({ preview });
}
