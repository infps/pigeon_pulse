import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const { raceId } = await params;

    if (!raceId) {
      return NextResponse.json(
        { message: "Race ID is required" },
        { status: 400 }
      );
    }

    const raceItems = await prisma.raceItem.findMany({
      where: { raceId },
      include: {
        bird: {
          include: {
            breeder: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { birdPosition: "asc" },
        { arrivalTime: "asc" },
      ],
    });

    return NextResponse.json(
      { raceItems, message: "Race items fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching race items:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
