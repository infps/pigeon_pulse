import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = parseInt(searchParams.get("limit") ?? "10");
    const offsetRaw = parseInt(searchParams.get("offset") ?? "0");
    const limit = Math.min(Math.max(isNaN(limitRaw) ? 10 : limitRaw, 1), 100);
    const offset = Math.max(isNaN(offsetRaw) ? 0 : offsetRaw, 0);

    const [messages, total] = await Promise.all([
      prisma.eventMessage.findMany({
        include: {
          event: {
            select: {
              id: true,
              name: true,
              shortName: true,
              logoImage: true,
              bannerImage: true,
            },
          },
          author: {
            select: { id: true, name: true, lastName: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.eventMessage.count(),
    ]);

    return NextResponse.json(
      { messages, total, message: "Messages fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching breeder messages:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
