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
 * Event rules and fees — the page AGN publishes and breeders agree to by
 * entering. Sections rather than one blob, so a fee change means editing one
 * section instead of retyping the page.
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

    const sections = await prisma.eventRuleSection.findMany({
      where: { seasonId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({ seasonId, sections });
  } catch (error) {
    console.error("Failed to load rules:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const sectionSchema = z.object({
  id: z.coerce.number().optional(),
  title: z.string().min(1).max(200),
  body: z.string().max(20000).default(""),
  sortOrder: z.coerce.number().int().optional(),
  isPublished: z.boolean().optional(),
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

    const body = sectionSchema.parse(await request.json());

    const data = {
      seasonId,
      title: body.title.trim(),
      body: body.body,
      sortOrder: body.sortOrder ?? 0,
      isPublished: body.isPublished ?? true,
      updatedAt: new Date(),
      updatedBy: session.user.id ?? null,
    };

    const saved = body.id
      ? await prisma.eventRuleSection.update({ where: { id: body.id }, data })
      : await prisma.eventRuleSection.create({ data });

    return NextResponse.json({ section: saved, message: `"${saved.title}" saved.` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "A section needs a title." }, { status: 400 });
    }
    console.error("Failed to save rule section:", error);
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
      return NextResponse.json({ message: "A section id is required" }, { status: 400 });
    }

    // Scoped to the season so one event cannot delete another's rules.
    const result = await prisma.eventRuleSection.deleteMany({ where: { id, seasonId } });
    if (result.count === 0) {
      return NextResponse.json({ message: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Section removed" });
  } catch (error) {
    console.error("Failed to delete rule section:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
