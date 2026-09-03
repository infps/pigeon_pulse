import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const breederIdRaw = searchParams.get("breederId");
    const band = searchParams.get("band");
    const color = searchParams.get("color");
    const sexRaw = searchParams.get("sex");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const AND: Prisma.BirdWhereInput[] = [];

    if (breederIdRaw) {
      const id = Number(breederIdRaw);
      if (Number.isFinite(id)) AND.push({ breederId: id });
    }

    if (band) AND.push({ band: { contains: band, mode: "insensitive" } });
    if (color) AND.push({ color });

    if (sexRaw !== null && sexRaw !== "") {
      const sex = Number(sexRaw);
      if (Number.isFinite(sex)) AND.push({ sex });
    }

    if (status === "active") AND.push({ isActive: 1, OR: [{ isLost: 0 }, { isLost: null }] });
    else if (status === "lost") AND.push({ isLost: 1 });

    if (search) {
      AND.push({
        OR: [
          { birdName: { contains: search, mode: "insensitive" } },
          { band: { contains: search, mode: "insensitive" } },
          { rfid: { contains: search, mode: "insensitive" } },
          { breeder: { firstName: { contains: search, mode: "insensitive" } } },
          { breeder: { lastName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.BirdWhereInput = AND.length ? { AND } : {};

    const birds = await prisma.bird.findMany({
      where,
      orderBy: { id: "desc" },
      take: 500,
      include: {
        breeder: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            user: { select: { loftName: true } },
          },
        },
        inventoryItems: {
          take: 1,
          orderBy: { id: "desc" },
          select: {
            id: true,
            eventInventory: {
              select: {
                season: {
                  select: {
                    event: { select: { id: true, name: true, eventDate: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ birds, message: "Birds fetched successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error fetching birds:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
