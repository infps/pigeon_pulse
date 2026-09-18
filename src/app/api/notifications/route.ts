import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * The signed-in user's notification feed.
 *
 *   GET  /api/notifications?unread=1&limit=50
 *   POST /api/notifications          { ids?: number[] }   mark read; all if omitted
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "1";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: session.user.id,
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          link: true,
          raceId: true,
          seasonId: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Failed to load notifications:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let ids: number[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.ids)) {
        ids = body.ids.map((v: unknown) => Number(v)).filter((v: number) => !Number.isNaN(v));
      }
    } catch {
      // No body — mark everything read.
    }

    const result = await prisma.notification.updateMany({
      // Scoped to this user, so a forged id cannot touch someone else's feed.
      where: {
        userId: session.user.id,
        readAt: null,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ markedRead: result.count });
  } catch (error) {
    console.error("Failed to mark notifications read:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
