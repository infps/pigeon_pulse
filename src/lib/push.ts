import { prisma } from "@/lib/prisma";

/**
 * Sending a push to the phones that have the app.
 *
 * This talks to Expo's push service rather than APNs and FCM directly. The app
 * is an Expo build, so Expo already holds the platform credentials and the
 * token it hands the client is the only address we need — going lower would
 * mean carrying an Apple key and a Firebase service account for no gain.
 *
 * Nothing here throws at the caller. A push is an announcement about something
 * that has already happened; failing to deliver it must not fail whatever
 * caused it, and the in-app Notification row is the record either way. The one
 * thing it does do is act on what the service reports back: a token the service
 * says is dead gets deactivated, because a device list that grows and never
 * shrinks stops being a count of anything.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo refuses more than 100 messages in one request. */
const CHUNK = 100;

export interface PushMessage {
  title: string;
  body: string;
  /** Rides along so the app can open the right screen when it is tapped. */
  data?: Record<string, unknown>;
}

export interface PushResult {
  sent: number;
  failed: number;
  deactivated: number;
  /** Set when the whole send could not be attempted. */
  problem?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** A token Expo will accept. Anything else is a client bug, not a device. */
export function looksLikeExpoToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token.trim());
}

/**
 * Push to an explicit set of tokens.
 *
 * Returns counts rather than throwing. `deactivated` is the number of tokens
 * the service rejected as unregistered, which have been switched off here so
 * the next send skips them.
 */
export async function pushToTokens(
  tokens: string[],
  message: PushMessage
): Promise<PushResult> {
  const valid = Array.from(new Set(tokens.filter(looksLikeExpoToken)));
  if (valid.length === 0) return { sent: 0, failed: 0, deactivated: 0 };

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  for (const batch of chunk(valid, CHUNK)) {
    const payload = batch.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: "default" as const,
      // Android needs a channel that the app has created, or the notification
      // arrives silently with no heads-up display.
      channelId: "default",
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "accept-encoding": "gzip, deflate",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        failed += batch.length;
        continue;
      }

      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];

      tickets.forEach((ticket, i) => {
        if (ticket.status === "ok") {
          sent += 1;
          return;
        }
        failed += 1;
        // The only error worth acting on immediately. The rest are transient
        // and the token stays live.
        if (ticket.details?.error === "DeviceNotRegistered") dead.push(batch[i]);
      });
    } catch {
      failed += batch.length;
    }
  }

  if (dead.length > 0) {
    try {
      await prisma.pushDevice.updateMany({
        where: { token: { in: dead } },
        data: { isActive: false },
      });
    } catch {
      // Deactivation is housekeeping; a failure here does not change what was
      // delivered, and the next send will try again.
    }
  }

  return { sent, failed, deactivated: dead.length };
}

/**
 * Push to whole accounts, whatever devices they have.
 *
 * Passing no user ids means everyone with a live device — the broadcast case.
 */
export async function pushToUsers(
  userIds: string[] | null,
  message: PushMessage
): Promise<PushResult> {
  try {
    const devices = await prisma.pushDevice.findMany({
      where: {
        isActive: true,
        ...(userIds && userIds.length > 0 ? { userId: { in: userIds } } : {}),
      },
      select: { token: true },
    });
    return await pushToTokens(
      devices.map((d) => d.token),
      message
    );
  } catch (error) {
    console.error("Push lookup failed:", error);
    return { sent: 0, failed: 0, deactivated: 0, problem: "Could not read the device list." };
  }
}
