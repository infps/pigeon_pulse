import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ basketId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { basketId } = await params;
    const basketIdInt = parseInt(basketId);

    // Check if basket has any items
    const basket = await prisma.basket.findUnique({
      where: { id: basketIdInt },
      include: {
        _count: {
          select: {
            raceItems: true,
            distItems: true,
          },
        },
      },
    });

    if (!basket) {
      return Response.json({ error: "Basket not found" }, { status: 404 });
    }

    if (basket._count.raceItems > 0 || basket._count.distItems > 0) {
      return Response.json(
        { error: "Cannot delete basket with items" },
        { status: 400 }
      );
    }

    await prisma.basket.delete({
      where: { id: basketIdInt },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting basket:", error);
    return Response.json(
      { error: "Failed to delete basket" },
      { status: 500 }
    );
  }
}
