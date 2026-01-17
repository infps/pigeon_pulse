import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const raceTypes = await prisma.raceType.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(
      { raceTypes, message: "Race types fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching race types:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
