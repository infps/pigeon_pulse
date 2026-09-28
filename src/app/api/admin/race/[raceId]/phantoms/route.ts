import { auth } from "@/lib/auth";
import { requireAnyPermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Phantom scans for a race — RFID reads that matched no bird.
 *
 * HayLoft kept these in RACE_PHANTOM_BIRD and expected an operator to work
 * through them; 31,487 rows came across in the migration with no interface to
 * resolve any of them.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requireAnyPermission(["races.view", "races.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    if (Number.isNaN(raceIdInt)) {
      return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });
    }

    const phantoms = await prisma.racePhantomBird.findMany({
      where: { raceId: raceIdInt },
      orderBy: [{ arrivalTime: "asc" }, { id: "asc" }],
      include: {
        bird: {
          select: {
            id: true,
            band1: true,
            band2: true,
            band3: true,
            band4: true,
            rfid: true,
            breeder: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json({ phantoms, count: phantoms.length });
  } catch (error) {
    console.error("Error listing phantom scans:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
