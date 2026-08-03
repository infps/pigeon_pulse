import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, generateImageKey } from "@/lib/r2";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { BirdImageType } from "@/generated/prisma/enums";

type Params = { params: Promise<{ eventId: string; birdId: string }> };

async function resolveSeasonId(eventId: number, seasonIdParam: string | null): Promise<number | null> {
  if (seasonIdParam) {
    const sid = parseInt(seasonIdParam);
    return isNaN(sid) ? null : sid;
  }
  const active = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    select: { id: true },
  });
  return active?.id ?? null;
}

// GET /api/admin/event/[eventId]/birds/[birdId]/images?seasonId=X
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId, birdId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = await resolveSeasonId(parseInt(eventId), searchParams.get("seasonId"));
    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const images = await prisma.birdImage.findMany({
      where: { birdId: parseInt(birdId), seasonId },
      orderBy: { takenAt: "asc" },
    });

    const grouped = {
      ARRIVAL: images.filter((i) => i.type === "ARRIVAL"),
      RACE: images.filter((i) => i.type === "RACE"),
      FINAL: images.filter((i) => i.type === "FINAL"),
    };

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Error fetching bird images:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/event/[eventId]/birds/[birdId]/images
// Body: formData with fields: image (File), type (ARRIVAL|RACE|FINAL), seasonId? (string)
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId, birdId } = await params;
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const typeRaw = formData.get("type") as string | null;
    const seasonIdParam = formData.get("seasonId") as string | null;

    if (!file) return NextResponse.json({ message: "No image provided" }, { status: 400 });
    if (!typeRaw || !["ARRIVAL", "RACE", "FINAL"].includes(typeRaw)) {
      return NextResponse.json({ message: "type must be ARRIVAL, RACE, or FINAL" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(parseInt(eventId), seasonIdParam);
    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const birdIdInt = parseInt(birdId);
    const bird = await prisma.bird.findUnique({ where: { id: birdIdInt }, select: { id: true } });
    if (!bird) return NextResponse.json({ message: "Bird not found" }, { status: 404 });

    const key = generateImageKey(`bird-images/${birdIdInt}/${seasonId}/${typeRaw.toLowerCase()}`, file.name);
    const { url } = await uploadToR2(file, key);

    const image = await prisma.birdImage.create({
      data: {
        birdId: birdIdInt,
        seasonId,
        type: typeRaw as BirdImageType,
        url,
        s3Key: key,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("Error uploading bird image:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
