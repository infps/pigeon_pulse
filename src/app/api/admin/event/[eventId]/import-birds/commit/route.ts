import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { BirdPreviewRow } from "../preview/route";

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

  const body = await request.json() as { rows: BirdPreviewRow[] };
  const rows = body.rows?.filter((r) => r.status === "ok");
  if (!rows?.length) return NextResponse.json({ message: "No valid rows to import" }, { status: 400 });

  const activeSeason = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (!activeSeason) return NextResponse.json({ message: "No active season for this event" }, { status: 404 });

  const races = await prisma.race.findMany({
    where: { seasonId: activeSeason.id },
    select: { id: true },
  });

  const results: { rowIndex: number; status: string; message: string; birdId?: number }[] = [];

  for (const row of rows) {
    try {
      let breederId = row.breederId;

      if (!breederId) {
        // Create new breeder
        const created = await prisma.breeder.create({
          data: {
            firstName: row.breederFirstName || null,
            lastName: row.breederLastName || null,
            email: row.breederEmail || null,
            loginName: row.breederEmail || null,
            status: 1,
          },
        });
        breederId = created.id;
      }

      const breeder = await prisma.breeder.findUnique({ where: { id: breederId } });
      if (!breeder) throw new Error("Breeder not found");

      const result = await prisma.$transaction(async (tx) => {
        const bird = await tx.bird.create({
          data: {
            birdName: row.birdName || `${row.band1}-${row.band2}-${row.band3}-${row.band4}`,
            band: row.band,
            band1: row.band1,
            band2: row.band2,
            band3: row.band3,
            band4: row.band4,
            color: row.color,
            sex: row.sex,
            rfid: row.rfid || null,
            attention: row.attention ?? false,
            breederId,
            isActive: 1,
            isLost: 0,
          },
        });

        let eventInventory = await tx.eventInventory.findFirst({
          where: { seasonId: activeSeason.id, breederId },
        });
        if (!eventInventory) {
          const loftName = breeder.lastName || breeder.firstName || "Default";
          eventInventory = await tx.eventInventory.create({
            data: { seasonId: activeSeason.id, breederId, loft: loftName, reservedBirds: 0 },
          });
        }

        const item = await tx.eventInventoryItem.create({
          data: { birdId: bird.id, eventInventoryId: eventInventory.id, isBackup: 0, arrivalDate: new Date() },
        });

        await tx.eventInventory.update({
          where: { id: eventInventory.id },
          data: { reservedBirds: { increment: 1 } },
        });

        if (races.length > 0) {
          await tx.raceItem.createMany({
            data: races.map((race) => ({ raceId: race.id, inventoryItemId: item.id })),
          });
        }

        return bird.id;
      });

      results.push({ rowIndex: row.rowIndex, status: "created", message: "Bird imported", birdId: result });
    } catch (err: any) {
      if (err?.code === "P2002") {
        results.push({ rowIndex: row.rowIndex, status: "skip_duplicate_band", message: `Band ${row.band} already exists` });
      } else {
        results.push({ rowIndex: row.rowIndex, status: "error", message: err?.message || "Unknown error" });
      }
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ results, summary: { created, failed } });
}
