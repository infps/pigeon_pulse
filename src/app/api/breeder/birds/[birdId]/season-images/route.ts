import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ birdId: string }> };

// GET /api/breeder/birds/[birdId]/season-images?seasonId=X
// Returns bird images for a specific season, only if the bird belongs to the breeder
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);
    const { birdId } = await params;
    const birdIdInt = parseInt(birdId);

    const bird = await prisma.bird.findUnique({ where: { id: birdIdInt }, select: { id: true, breederId: true } });
    if (!bird) return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    if (bird.breederId !== breeder.id) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const seasonIdParam = searchParams.get("seasonId");
    if (!seasonIdParam) return NextResponse.json({ message: "seasonId required" }, { status: 400 });
    const seasonId = parseInt(seasonIdParam);
    if (isNaN(seasonId)) return NextResponse.json({ message: "Invalid seasonId" }, { status: 400 });

    const images = await prisma.birdImage.findMany({
      where: { birdId: birdIdInt, seasonId },
      orderBy: { takenAt: "asc" },
      select: { id: true, type: true, url: true, takenAt: true },
    });

    const grouped = {
      ARRIVAL: images.filter((i) => i.type === "ARRIVAL"),
      RACE: images.filter((i) => i.type === "RACE"),
      FINAL: images.filter((i) => i.type === "FINAL"),
    };

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Error fetching breeder bird images:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
