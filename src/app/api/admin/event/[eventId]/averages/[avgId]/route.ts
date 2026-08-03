import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { AverageFilterMode } from "@/generated/prisma/enums";

type Params = { params: Promise<{ eventId: string; avgId: string }> };

// PATCH /api/admin/event/[eventId]/averages/[avgId]
// Body: { name?, isPublic?, filterMode?, raceTypeIds?, raceIds? }
export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { avgId } = await params;
    const configId = parseInt(avgId);
    const body = await request.json();
    const { name, isPublic, filterMode, raceTypeIds, raceIds } = body;

    const existing = await prisma.averageConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

    if (filterMode && !Object.values(AverageFilterMode).includes(filterMode)) {
      return NextResponse.json({ message: "Invalid filterMode" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Replace race type selections if provided
      if (raceTypeIds !== undefined) {
        await tx.averageConfigRaceType.deleteMany({ where: { configId } });
        await tx.averageConfigRaceType.createMany({
          data: raceTypeIds.map((id: number) => ({ configId, raceTypeId: id })),
        });
      }
      // Replace race selections if provided
      if (raceIds !== undefined) {
        await tx.averageConfigRace.deleteMany({ where: { configId } });
        await tx.averageConfigRace.createMany({
          data: raceIds.map((id: number) => ({ configId, raceId: id })),
        });
      }
      await tx.averageConfig.update({
        where: { id: configId },
        data: {
          ...(name !== undefined && { name }),
          ...(isPublic !== undefined && { isPublic }),
          ...(filterMode !== undefined && { filterMode }),
        },
      });
    });

    const updated = await prisma.averageConfig.findUnique({
      where: { id: configId },
      include: {
        selectedRaceTypes: { include: { raceType: { select: { id: true, name: true } } } },
        selectedRaces: { include: { race: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating average config:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/event/[eventId]/averages/[avgId]
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { avgId } = await params;
    const configId = parseInt(avgId);

    const existing = await prisma.averageConfig.findUnique({ where: { id: configId } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

    await prisma.averageConfig.delete({ where: { id: configId } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Error deleting average config:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
