import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isStaff } from "@/lib/roles";

/**
 * Public organization profile — the One Loft front door.
 *
 * Returns the event's details, a season-at-a-glance summary, and which tabs this
 * viewer may open. Gated tabs are reported rather than omitted, so the page can
 * show a "sign in to view" card in place of the data instead of pretending the
 * tab does not exist.
 */
const DEFAULT_TABS = [
  "profile",
  "winners",
  "breeders",
  "birds",
  "results",
  "updates",
  "stations",
  "rules",
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: await headers() });
    const signedIn = session?.user != null;
    const staff = isStaff(session?.user?.role);

    const event = await prisma.event.findUnique({
      where: { id: eventIdInt },
      select: {
        id: true,
        name: true,
        shortName: true,
        description: true,
        eventDate: true,
        endDate: true,
        isOpen: true,
        isPrivate: true,
        latitude: true,
        longitude: true,
        locationAddress: true,
        logoImage: true,
        bannerImage: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        contactWebsite: true,
        contactAddress: true,
        socialYt: true,
        socialFb: true,
        socialTwitter: true,
        socialInsta: true,
        eventType: { select: { name: true } },
        tabVisibility: { select: { tab: true, requiresSignIn: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ message: "Event not found" }, { status: 404 });
    }

    // A private event stays invisible to people with no registration in it.
    if (event.isPrivate && !staff) {
      const breeder = session?.user?.id
        ? await prisma.breeder.findUnique({
            where: { userId: session.user.id },
            select: { id: true },
          })
        : null;
      const registered = breeder
        ? (await prisma.eventInventory.count({
            where: { breederId: breeder.id, season: { eventId: eventIdInt } },
          })) > 0
        : false;
      if (!registered) {
        return NextResponse.json({ message: "Event not found" }, { status: 404 });
      }
    }

    const season = await prisma.season.findFirst({
      where: { eventId: eventIdInt, isActive: true },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    // Season at a glance: the three figures One Loft leads with.
    let glance = { breeders: 0, activeBirds: 0, releases: 0 };
    if (season) {
      const [breeders, activeBirds, releases] = await Promise.all([
        prisma.eventInventory.count({ where: { seasonId: season.id } }),
        prisma.eventInventoryItem.count({
          where: {
            eventInventory: { seasonId: season.id },
            bird: { NOT: { isLost: 1 } },
          },
        }),
        prisma.race.count({ where: { seasonId: season.id, status: { not: "REGISTERING" } } }),
      ]);
      glance = { breeders, activeBirds, releases };
    }

    // Absence of a row means public, so an event nobody has configured behaves
    // exactly as it does today.
    const gated = new Map(event.tabVisibility.map((t) => [t.tab, t.requiresSignIn]));
    const tabs = DEFAULT_TABS.map((tab) => {
      const requiresSignIn = gated.get(tab) ?? false;
      return {
        tab,
        requiresSignIn,
        // Staff and signed-in members see everything a gate would hide.
        visible: !requiresSignIn || signedIn || staff,
      };
    });

    return NextResponse.json({
      event: { ...event, tabVisibility: undefined },
      season,
      glance,
      tabs,
      viewer: { signedIn, staff },
    });
  } catch (error) {
    console.error("Failed to load public profile:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
