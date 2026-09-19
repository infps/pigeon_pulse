import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Standalone breeder transfer — writes BirdBreederHistory and updates eventInventory.breederId
export async function POST(
  request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  const { birdId: idParam } = await params;
  const inventoryItemId = parseInt(idParam);
  if (isNaN(inventoryItemId)) return NextResponse.json({ message: "Invalid item ID" }, { status: 400 });

  const guard = await requirePermission("birds.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

  const { newBreederId } = await request.json();
  if (!newBreederId) return NextResponse.json({ message: "newBreederId required" }, { status: 400 });

  const item = await prisma.eventInventoryItem.findUnique({
    where: { id: inventoryItemId },
    include: {
      eventInventory: {
        include: { breeder: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  if (!item) return NextResponse.json({ message: "Item not found" }, { status: 404 });

  const newBreeder = await prisma.breeder.findUnique({
    where: { id: parseInt(newBreederId) },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!newBreeder) return NextResponse.json({ message: "Breeder not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    const currentBreeder = item.eventInventory?.breeder;
    if (currentBreeder) {
      const name = [currentBreeder.firstName, currentBreeder.lastName].filter(Boolean).join(" ");
      await tx.birdBreederHistory.create({
        data: { inventoryItemId, fromBreederName: name },
      });
    }

    if (item.eventInventoryId) {
      await tx.eventInventory.update({
        where: { id: item.eventInventoryId },
        data: { breederId: newBreeder.id },
      });
    }
  });

  return NextResponse.json({ message: "Breeder transferred", newBreederId: newBreeder.id });
}
