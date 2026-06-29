import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; inventoryId: string }> }
) {
  const { inventoryId: inventoryIdParam } = await params;
  const inventoryId = parseInt(inventoryIdParam);
  if (isNaN(inventoryId)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const inv = await prisma.eventInventory.findUnique({ where: { id: inventoryId }, select: { cashPromised: true } });
    if (!inv) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const updated = await prisma.eventInventory.update({
      where: { id: inventoryId },
      data: { cashPromised: !inv.cashPromised },
    });

    return NextResponse.json({ cashPromised: updated.cashPromised });
  } catch (error) {
    console.error("Error toggling cash promise:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
