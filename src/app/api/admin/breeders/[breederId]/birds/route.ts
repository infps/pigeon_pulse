import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ breederId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { breederId } = await params;
    const breederIdInt = parseInt(breederId);
    if (isNaN(breederIdInt)) {
      return NextResponse.json({ message: "Invalid breeder ID" }, { status: 400 });
    }

    const birds = await prisma.bird.findMany({
      where: { breederId: breederIdInt, isActive: 1 },
      orderBy: { birdName: "asc" },
    });

    return NextResponse.json({ birds }, { status: 200 });
  } catch (error) {
    console.error("Error fetching breeder birds:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
