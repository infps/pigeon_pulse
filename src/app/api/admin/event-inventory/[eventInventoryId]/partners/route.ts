import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return null;
  }
  return session;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventInventoryId: string }> }
) {
  const { eventInventoryId: param } = await params;
  const eventInventoryId = parseInt(param);
  if (isNaN(eventInventoryId)) {
    return NextResponse.json({ message: "Invalid event inventory ID" }, { status: 400 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { breederId } = await request.json();
    if (!breederId) {
      return NextResponse.json({ message: "breederId required" }, { status: 400 });
    }

    const existing = await prisma.partner.findUnique({
      where: { breederId_eventInventoryId: { breederId, eventInventoryId } },
    });
    if (existing) {
      return NextResponse.json({ message: "Partner already added" }, { status: 409 });
    }

    const partner = await prisma.partner.create({
      data: { breederId, eventInventoryId },
      include: { breeder: true },
    });

    return NextResponse.json({ partner }, { status: 201 });
  } catch (error) {
    console.error("Error adding partner:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventInventoryId: string }> }
) {
  const { eventInventoryId: param } = await params;
  const eventInventoryId = parseInt(param);
  if (isNaN(eventInventoryId)) {
    return NextResponse.json({ message: "Invalid event inventory ID" }, { status: 400 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { breederId } = await request.json();
    if (!breederId) {
      return NextResponse.json({ message: "breederId required" }, { status: 400 });
    }

    await prisma.partner.delete({
      where: { breederId_eventInventoryId: { breederId, eventInventoryId } },
    });

    return NextResponse.json({ message: "Partner removed" }, { status: 200 });
  } catch (error) {
    console.error("Error removing partner:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
