import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const param = new URL(request.url).searchParams.get("seasonId");
  if (param) {
    const parsed = parseInt(param, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const active = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (!active) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return active.id;
}

/**
 * Scanner-to-section mappings for a season.
 *
 * GET also returns serials that have been seen but never mapped, so an operator
 * can set up a new reader by plugging it in and scanning once rather than
 * hunting for its serial number.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const [mappings, groups, recentSerials] = await Promise.all([
      prisma.scannerMapping.findMany({
        where: { seasonId },
        orderBy: [{ isActive: "desc" }, { scannerSerial: "asc" }],
        select: {
          id: true,
          scannerSerial: true,
          eventGroupId: true,
          label: true,
          isActive: true,
          lastSeenAt: true,
          scanCount: true,
          eventGroup: { select: { id: true, name: true, type: true, status: true } },
        },
      }),
      prisma.eventGroup.findMany({
        where: { seasonId, type: "LOFT" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, status: true },
      }),
      // Serials heard from in the last week, so an unmapped reader is easy to find.
      prisma.rfidScan.groupBy({
        by: ["scannerId"],
        where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        _count: { _all: true },
        _max: { timestamp: true },
        orderBy: { _max: { timestamp: "desc" } },
        take: 25,
      }),
    ]);

    const mapped = new Set(mappings.map((m) => m.scannerSerial));

    return NextResponse.json({
      seasonId,
      mappings,
      groups,
      unmappedSerials: recentSerials
        .filter((s) => !mapped.has(s.scannerId))
        .map((s) => ({
          scannerSerial: s.scannerId,
          scanCount: s._count._all,
          lastSeenAt: s._max.timestamp,
        })),
    });
  } catch (error) {
    console.error("Failed to load scanner mappings:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const upsertSchema = z.object({
  scannerSerial: z.string().min(1).max(200),
  eventGroupId: z.coerce.number().nullish(),
  label: z.string().max(120).nullish(),
  isActive: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const body = upsertSchema.parse(await request.json());

    // A group has to belong to this season, or a mapping could file birds into
    // another event's pen.
    if (body.eventGroupId != null) {
      const group = await prisma.eventGroup.findFirst({
        where: { id: body.eventGroupId, seasonId },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json(
          { message: "That loft section does not belong to this season." },
          { status: 400 }
        );
      }
    }

    const mapping = await prisma.scannerMapping.upsert({
      where: { seasonId_scannerSerial: { seasonId, scannerSerial: body.scannerSerial } },
      create: {
        seasonId,
        scannerSerial: body.scannerSerial,
        eventGroupId: body.eventGroupId ?? null,
        label: body.label ?? null,
        isActive: body.isActive ?? true,
      },
      update: {
        eventGroupId: body.eventGroupId ?? null,
        label: body.label ?? null,
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      select: {
        id: true,
        scannerSerial: true,
        label: true,
        isActive: true,
        eventGroup: { select: { name: true } },
      },
    });

    return NextResponse.json({
      mapping,
      message: mapping.eventGroup?.name
        ? `${mapping.label ?? mapping.scannerSerial} files birds into ${mapping.eventGroup.name}.`
        : `${mapping.label ?? mapping.scannerSerial} saved without a section, so it will not file birds.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "A scanner serial is required." }, { status: 400 });
    }
    console.error("Failed to save scanner mapping:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const idParam = new URL(request.url).searchParams.get("id");
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (Number.isNaN(id)) {
      return NextResponse.json({ message: "A mapping id is required" }, { status: 400 });
    }

    // Scoped to the season so one event cannot delete another's mapping.
    const result = await prisma.scannerMapping.deleteMany({ where: { id, seasonId } });
    if (result.count === 0) {
      return NextResponse.json({ message: "Mapping not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Mapping removed" });
  } catch (error) {
    console.error("Failed to delete scanner mapping:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
