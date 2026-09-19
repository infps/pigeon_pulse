import { auth } from "@/lib/auth";
import { requireAnyPermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const guard = await requireAnyPermission(["events.view", "events.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const seasons = await prisma.season.findMany({
      orderBy: { startDate: "desc" },
      include: { event: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ seasons });
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
