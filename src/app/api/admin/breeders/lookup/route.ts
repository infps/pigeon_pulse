import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ message: "q required" }, { status: 400 });
    }

    const asNumber = /^\d+$/.test(q) ? parseInt(q, 10) : null;

    const breeder = await prisma.breeder.findFirst({
      where: {
        OR: [
          ...(asNumber !== null ? [{ id: asNumber }, { number: asNumber }] : []),
          {
            user: {
              OR: [
                { username: q },
                { displayUsername: q },
                { email: q },
              ],
            },
          },
          { loginName: q },
          { email: q },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        loginName: true,
        number: true,
        user: {
          select: { username: true, displayUsername: true, loftName: true, image: true },
        },
      },
    });

    if (!breeder) {
      return NextResponse.json({ message: "Breeder not found" }, { status: 404 });
    }

    return NextResponse.json({ breeder, message: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Error looking up breeder:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
