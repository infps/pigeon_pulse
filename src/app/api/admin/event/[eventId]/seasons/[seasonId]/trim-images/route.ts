import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { BirdImageType } from "@/generated/prisma/enums";

type Params = { params: Promise<{ eventId: string; seasonId: string }> };

// POST /api/admin/event/[eventId]/seasons/[seasonId]/trim-images
// For each bird+type in the season, keep only earliest + latest image, delete rest from R2 + DB.
// Manual trigger — run after a season ends before starting a new one.
export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId, seasonId } = await params;
    const seasonIdInt = parseInt(seasonId);

    // Verify season belongs to event
    const season = await prisma.season.findFirst({
      where: { id: seasonIdInt, eventId: parseInt(eventId) },
      select: { id: true },
    });
    if (!season) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const types: BirdImageType[] = ["ARRIVAL", "RACE", "FINAL"];
    let deletedCount = 0;

    // Get all distinct birdIds in this season
    const birdIds = await prisma.birdImage.findMany({
      where: { seasonId: seasonIdInt },
      select: { birdId: true },
      distinct: ["birdId"],
    });

    for (const { birdId } of birdIds) {
      for (const type of types) {
        const images = await prisma.birdImage.findMany({
          where: { birdId, seasonId: seasonIdInt, type },
          orderBy: { takenAt: "asc" },
          select: { id: true, s3Key: true },
        });

        // Keep first + last; if ≤2 images nothing to trim
        if (images.length <= 2) continue;

        const toDelete = images.slice(1, images.length - 1); // middle ones

        for (const img of toDelete) {
          try {
            await deleteFromR2(img.s3Key);
          } catch {
            // Log but continue — DB record still gets removed
            console.warn(`R2 delete failed for key ${img.s3Key}`);
          }
          await prisma.birdImage.delete({ where: { id: img.id } });
          deletedCount++;
        }
      }
    }

    return NextResponse.json({ message: "Trim complete", deletedCount });
  } catch (error) {
    console.error("Error trimming bird images:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
