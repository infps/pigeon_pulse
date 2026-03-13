import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const breeders = await prisma.breeder.findMany({
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json(
      { breeders, message: "Breeders fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching breeders:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
