import { auth } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/authorize";
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
 * Race videos — the Videos column on the handler menu.
 *
 * Links, not uploads: these are YouTube recordings of releases and arrivals, and
 * hosting video is not this system's job.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requireAnyPermission(["content.view", "content.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const videos = await prisma.eventVideo.findMany({
      where: { seasonId },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        url: true,
        description: true,
        publishedAt: true,
        isPublic: true,
        sortOrder: true,
        raceId: true,
        race: { select: { name: true, raceNumber: true } },
      },
    });

    return NextResponse.json({ seasonId, videos });
  } catch (error) {
    console.error("Failed to load videos:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const videoSchema = z.object({
  id: z.coerce.number().optional(),
  title: z.string().min(1).max(200),
  url: z.string().url("A video needs a full URL"),
  description: z.string().max(2000).nullish(),
  raceId: z.coerce.number().nullish(),
  publishedAt: z.string().nullish(),
  sortOrder: z.coerce.number().int().optional(),
  isPublic: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("content.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const body = videoSchema.parse(await request.json());

    const publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;

    const data = {
      seasonId,
      title: body.title.trim(),
      url: body.url.trim(),
      description: body.description ?? null,
      raceId: body.raceId ?? null,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      sortOrder: body.sortOrder ?? 0,
      isPublic: body.isPublic ?? true,
    };

    const saved = body.id
      ? await prisma.eventVideo.update({ where: { id: body.id }, data })
      : await prisma.eventVideo.create({ data });

    return NextResponse.json({ video: saved, message: `"${saved.title}" saved.` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "A video needs a title and a full URL." },
        { status: 400 }
      );
    }
    console.error("Failed to save video:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("content.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

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
      return NextResponse.json({ message: "A video id is required" }, { status: 400 });
    }

    const result = await prisma.eventVideo.deleteMany({ where: { id, seasonId } });
    if (result.count === 0) {
      return NextResponse.json({ message: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Video removed" });
  } catch (error) {
    console.error("Failed to delete video:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
