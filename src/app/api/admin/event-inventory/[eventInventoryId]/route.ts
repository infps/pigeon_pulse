import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventInventoryId: string }> }
) {
  const { eventInventoryId } = await params;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const eventInventory = await prisma.eventInventory.findUnique({
      where: {
        eventInventoryId,
      },
      include: {
        breeder: true,
        event: {
          include: {
            bettingScheme: true,
            feeScheme: {
              include: {
                perchFeeItems: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            paidAt: "desc",
          },
        },
        eventInventoryItems: {
          include: {
            bird: true,
          },
          orderBy: {
            birdNo: "asc",
          },
        },
      },
    });

    if (!eventInventory) {
      return NextResponse.json(
        { message: "Event inventory not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        eventInventory,
        message: "Event inventory fetched successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event inventory:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
