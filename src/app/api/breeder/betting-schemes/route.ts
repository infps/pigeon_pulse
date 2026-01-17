import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const bettingSchemes = await prisma.bettingScheme.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
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
      { bettingSchemes, message: "Betting schemes fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching betting schemes:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
