import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ breederId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const guard = await requirePermission("breeders.manage");
    if ("error" in guard) return guard.error;

    const { breederId } = await params;
    const breederIdInt = parseInt(breederId);
    if (isNaN(breederIdInt)) {
      return NextResponse.json({ message: "Invalid breeder ID" }, { status: 400 });
    }

    const birds = await prisma.bird.findMany({
      where: { breederId: breederIdInt },
      orderBy: { birdName: "asc" },
    });

    return NextResponse.json({ birds }, { status: 200 });
  } catch (error) {
    console.error("Error fetching breeder birds:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
