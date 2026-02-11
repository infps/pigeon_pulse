import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const inventories = await prisma.eventInventory.findMany({
      where: { breederId: session.user.id },
      include: {
        event: true,
        eventInventoryItems: {
          include: {
            bird: true,
          },
        },
      },
      orderBy: { registrationDate: "desc" },
    });

    return NextResponse.json(
      { inventories, message: "Event inventories fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event inventories:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
