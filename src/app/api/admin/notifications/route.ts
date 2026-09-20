import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requirePermission } from "@/lib/authorize";
import { pushToUsers } from "@/lib/push";
import { NextRequest, NextResponse } from "next/server";

/**
 * Sending an announcement to the phones, and seeing who it would reach.
 *
 *   GET   — how many devices are registered, and the last few sends
 *   POST  — write the notification and push it
 *
 * The write comes first and the push second, deliberately. The in-app feed is
 * the record: a person who had notifications switched off, or whose phone was
 * flat, still finds the announcement when they next open the app. Push is the
 * tap on the shoulder, not the message — so a push that fails leaves the
 * announcement intact rather than losing it.
 *
 * An audience of everyone is a separate permission from sending at all. A
 * message to one breeder about their own birds and a message to every handset
 * in the organisation are not the same act, and the second is the one that
 * cannot be taken back.
 */

const MAX_TITLE = 100;
const MAX_BODY = 500;

export async function GET() {
  const guard = await requireAnyPermission(["notifications.view", "notifications.manage"]);
  if ("error" in guard) return guard.error;

  try {
    const [devices, activeDevices, reachable, recent] = await Promise.all([
      prisma.pushDevice.count(),
      prisma.pushDevice.count({ where: { isActive: true } }),
      prisma.pushDevice.findMany({
        where: { isActive: true },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.notification.findMany({
        where: { kind: "ANNOUNCEMENT" },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          title: true,
          body: true,
          createdAt: true,
          deliveredAt: true,
          userId: true,
        },
      }),
    ]);

    // Announcements fan out to one row per person, so the feed would otherwise
    // show the same message forty times. Collapse to one entry per send.
    const byMessage = new Map<
      string,
      { title: string; body: string; createdAt: Date; recipients: number }
    >();
    for (const row of recent) {
      const key = `${row.title}::${row.body}::${row.createdAt.toISOString().slice(0, 16)}`;
      const found = byMessage.get(key);
      if (found) found.recipients += 1;
      else
        byMessage.set(key, {
          title: row.title,
          body: row.body,
          createdAt: row.createdAt,
          recipients: 1,
        });
    }

    return NextResponse.json({
      devices,
      activeDevices,
      reachableAccounts: reachable.length,
      recent: Array.from(byMessage.values()).slice(0, 10),
    });
  } catch (error) {
    console.error("Failed to load notification stats:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requirePermission("notifications.manage");
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json().catch(() => ({}));

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.body === "string" ? body.body.trim() : "";
    const link = typeof body.link === "string" && body.link.trim() ? body.link.trim() : null;

    if (!title) {
      return NextResponse.json({ message: "An announcement needs a title." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ message: "An announcement needs a body." }, { status: 400 });
    }
    if (title.length > MAX_TITLE || message.length > MAX_BODY) {
      return NextResponse.json(
        { message: `Keep the title under ${MAX_TITLE} and the body under ${MAX_BODY}.` },
        { status: 400 }
      );
    }

    /**
     * Who it goes to. Explicit ids, everyone holding a role, or everyone —
     * and only the last of those needs the extra permission.
     */
    const audience: string = typeof body.audience === "string" ? body.audience : "all";
    let userIds: string[];

    if (audience === "users") {
      const given: unknown = body.userIds;
      if (!Array.isArray(given) || given.length === 0) {
        return NextResponse.json({ message: "Pick who it goes to." }, { status: 400 });
      }
      userIds = given.filter((id): id is string => typeof id === "string");
    } else if (audience === "role") {
      const role = typeof body.role === "string" ? body.role : null;
      if (!role) {
        return NextResponse.json({ message: "Pick a role." }, { status: 400 });
      }
      const rows = await prisma.user.findMany({ where: { role: role as never }, select: { id: true } });
      userIds = rows.map((r) => r.id);
    } else {
      const broadcast = await requirePermission("notifications.send");
      if ("error" in broadcast) return broadcast.error;
      const rows = await prisma.user.findMany({ select: { id: true } });
      userIds = rows.map((r) => r.id);
    }

    if (userIds.length === 0) {
      return NextResponse.json({ message: "That audience has nobody in it." }, { status: 400 });
    }

    // The record, written before anything is sent.
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: "ANNOUNCEMENT" as const,
        title,
        body: message,
        link,
      })),
    });

    const result = await pushToUsers(userIds, {
      title,
      body: message,
      data: link ? { link } : {},
    });

    if (result.sent > 0) {
      await prisma.notification
        .updateMany({
          where: { userId: { in: userIds }, title, body: message, deliveredAt: null },
          data: { deliveredAt: new Date() },
        })
        .catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      recipients: userIds.length,
      ...result,
      message:
        result.sent > 0
          ? `Posted to ${userIds.length} ${userIds.length === 1 ? "person" : "people"}, pushed to ${result.sent} ${result.sent === 1 ? "device" : "devices"}.`
          : `Posted to ${userIds.length} ${userIds.length === 1 ? "person" : "people"}. No device was reachable, so they will see it when they next open the app.`,
    });
  } catch (error) {
    console.error("Failed to send announcement:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
