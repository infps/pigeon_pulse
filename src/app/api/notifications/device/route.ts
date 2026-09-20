import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { looksLikeExpoToken } from "@/lib/push";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * The app telling the portal where to reach it.
 *
 * Called by the mobile app after sign-in, and again whenever the push token
 * changes — which it does on reinstall, on restore to a new handset, and
 * occasionally for no reason the client can see. So this is an upsert keyed on
 * the token, not an insert: registering the same device twice must not grow
 * the list.
 *
 * The token is claimed by whoever registers it. On a shared handset — an
 * operator signing in on a breeder's phone to fix something — the previous
 * owner must stop receiving that device's notifications, and the way that
 * happens is the ownership being overwritten rather than a second row existing
 * for the same token.
 *
 * Any signed-in account may register. There is no permission on this: being
 * reachable is not a privilege, and the alternative is breeders silently not
 * receiving anything.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!looksLikeExpoToken(token)) {
      return NextResponse.json(
        { message: "That is not an Expo push token." },
        { status: 400 }
      );
    }

    const platform = typeof body.platform === "string" ? body.platform.slice(0, 32) : null;
    const deviceName =
      typeof body.deviceName === "string" ? body.deviceName.slice(0, 120) : null;

    const device = await prisma.pushDevice.upsert({
      where: { token },
      create: { token, userId: session.user.id, platform, deviceName },
      update: {
        userId: session.user.id,
        platform,
        deviceName,
        // Re-registering revives a device the push service had told us was
        // gone: the app is plainly running again.
        isActive: true,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, deviceId: device.id });
  } catch (error) {
    console.error("Failed to register push device:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/** Sign-out, or a person turning notifications off. */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ message: "A token is required" }, { status: 400 });
    }

    // Scoped to the caller so one account cannot unregister another's device.
    await prisma.pushDevice.deleteMany({
      where: { token, userId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to remove push device:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
