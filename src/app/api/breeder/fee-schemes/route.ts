import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const feeSchemes = await prisma.feeScheme.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        birdFeeItems: {
          orderBy: {
            birdNo: "asc",
          },
        },
        raceTypes: {
          include: {
            raceType: true,
          },
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
      { feeSchemes, message: "Fee schemes fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching fee schemes:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
