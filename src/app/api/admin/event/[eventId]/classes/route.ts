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

/** Classes for a season, with how many birds are in each and what they hold. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requireAnyPermission(["classes.view", "classes.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const classes = await prisma.raceClass.findMany({
      where: { seasonId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        description: true,
        classFee: true,
        payoutType: true,
        przEntry: true,
        cutPercent: true,
        sortOrder: true,
        isActive: true,
        entries: { select: { feeCharged: true } },
      },
    });

    return NextResponse.json({
      seasonId,
      classes: classes.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        classFee: c.classFee,
        payoutType: c.payoutType,
        przEntry: c.przEntry,
        cutPercent: c.cutPercent,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        entryCount: c.entries.length,
        pool: c.entries.reduce((sum, e) => sum + (e.feeCharged ?? 0), 0),
      })),
    });
  } catch (error) {
    console.error("Failed to load classes:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const upsertSchema = z.object({
  id: z.coerce.number().optional(),
  code: z.string().min(1).max(12),
  description: z.string().max(200).nullish(),
  classFee: z.coerce.number().min(0),
  payoutType: z.enum(["RATIO", "WTA", "PLACES"]),
  przEntry: z.coerce.number().int().min(1),
  cutPercent: z.coerce.number().min(0).max(100).nullish(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("classes.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const seasonId = await resolveSeasonId(request, eventIdInt);
    if (seasonId instanceof NextResponse) return seasonId;

    const body = upsertSchema.parse(await request.json());
    const code = body.code.trim().toUpperCase();

    // WTA pays one bird by definition, so przEntry is forced rather than
    // trusted — an operator typing 3 next to "winner take all" means WTA.
    const przEntry = body.payoutType === "WTA" ? 1 : body.przEntry;

    const data = {
      seasonId,
      code,
      description: body.description ?? null,
      classFee: body.classFee,
      payoutType: body.payoutType,
      przEntry,
      cutPercent: body.cutPercent ?? null,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    };

    const saved = body.id
      ? await prisma.raceClass.update({ where: { id: body.id }, data })
      : await prisma.raceClass.create({ data });

    return NextResponse.json({
      class: saved,
      message: `Class ${saved.code} saved.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "A class needs a code, a fee, a payout type and an entries-per-prize value." },
        { status: 400 }
      );
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { message: "That class letter is already used in this season." },
        { status: 409 }
      );
    }
    console.error("Failed to save class:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const guard = await requirePermission("classes.manage");
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
      return NextResponse.json({ message: "A class id is required" }, { status: 400 });
    }

    const target = await prisma.raceClass.findFirst({
      where: { id, seasonId },
      select: { id: true, code: true, _count: { select: { entries: true } } },
    });
    if (!target) {
      return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }

    // Deleting a class with birds in it would silently destroy what breeders
    // paid for. Deactivating keeps the record and stops new entries.
    if (target._count.entries > 0) {
      await prisma.raceClass.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        message: `Class ${target.code} has ${target._count.entries} birds entered, so it was closed rather than deleted.`,
        deactivated: true,
      });
    }

    await prisma.raceClass.delete({ where: { id } });
    return NextResponse.json({ message: `Class ${target.code} deleted.` });
  } catch (error) {
    console.error("Failed to delete class:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
