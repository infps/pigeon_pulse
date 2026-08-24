import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
