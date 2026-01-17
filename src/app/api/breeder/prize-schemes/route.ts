import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const prizeSchemes = await prisma.prizeScheme.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        prizeSchemeItems: {
          include: {
            raceType: true,
          },
          orderBy: [
            {
              raceTypeId: "asc",
            },
            {
              fromPosition: "asc",
            },
          ],
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return NextResponse.json(
      { prizeSchemes, message: "Prize schemes fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching prize schemes:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
