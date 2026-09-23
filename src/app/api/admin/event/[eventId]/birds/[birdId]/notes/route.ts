import { requireAnyPermission, requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; birdId: string }> };

// Season resolution mirrors the images route: explicit ?seasonId wins, else the
// event's active season.
async function resolveSeasonId(eventId: number, seasonIdParam: string | null): Promise<number | null> {
  if (seasonIdParam) {
    const sid = parseInt(seasonIdParam);
    return isNaN(sid) ? null : sid;
  }
  const active = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    select: { id: true },
  });
  return active?.id ?? null;
}

// GET /api/admin/event/[eventId]/birds/[birdId]/notes?seasonId=X — newest first
export async function GET(request: Request, { params }: Params) {
  try {
    const guard = await requireAnyPermission(["events.view", "events.manage"]);
    if ("error" in guard) return guard.error;

    const { eventId, birdId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = await resolveSeasonId(parseInt(eventId), searchParams.get("seasonId"));
    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const notes = await prisma.birdNote.findMany({
      where: { birdId: parseInt(birdId), seasonId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error fetching bird notes:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/event/[eventId]/birds/[birdId]/notes  body: { text, seasonId? }
export async function POST(request: Request, { params }: Params) {
  try {
    const guard = await requirePermission("events.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId, birdId } = await params;
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ message: "Note text required" }, { status: 400 });

    const seasonId = await resolveSeasonId(parseInt(eventId), body.seasonId ? String(body.seasonId) : null);
    if (!seasonId) return NextResponse.json({ message: "Season not found" }, { status: 404 });

    const birdIdInt = parseInt(birdId);
    const bird = await prisma.bird.findUnique({ where: { id: birdIdInt }, select: { id: true } });
    if (!bird) return NextResponse.json({ message: "Bird not found" }, { status: 404 });

    const note = await prisma.birdNote.create({
      data: {
        birdId: birdIdInt,
        seasonId,
        text,
        authorId: session.user.id,
        authorName: (session.user as { name?: string }).name ?? null,
      },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating bird note:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/event/[eventId]/birds/[birdId]/notes?noteId=X
export async function DELETE(request: Request, { params }: Params) {
  try {
    const guard = await requirePermission("events.manage");
    if ("error" in guard) return guard.error;

    const { birdId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = parseInt(searchParams.get("noteId") ?? "");
    if (isNaN(noteId)) return NextResponse.json({ message: "noteId required" }, { status: 400 });

    // scope delete to this bird so a stray id can't wipe another bird's note
    const res = await prisma.birdNote.deleteMany({ where: { id: noteId, birdId: parseInt(birdId) } });
    if (res.count === 0) return NextResponse.json({ message: "Note not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting bird note:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
