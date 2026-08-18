import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const TRIGGERS = ["REGISTER", "CHECKIN", "RELEASE", "ARRIVE", "LOST", "INJURED", "MANUAL"];

async function guard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) return null;
  return session;
}

// GET — list configurable statuses for a season (?seasonId=). Falls back to global.
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await guard())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await params;
  const seasonId = new URL(req.url).searchParams.get("seasonId");
  const presets = await prisma.birdStatusPreset.findMany({
    where: seasonId ? { OR: [{ seasonId: parseInt(seasonId) }, { seasonId: null }] } : {},
    orderBy: [{ seasonId: "desc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ presets });
}

// POST — create a status preset. Body: { seasonId?, code, label, color?, trigger, sortOrder? }
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!(await guard())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await params;
  const b = await req.json().catch(() => ({}));
  if (!b.code || !b.label) return NextResponse.json({ message: "code and label required" }, { status: 400 });
  const trigger = TRIGGERS.includes(b.trigger) ? b.trigger : "MANUAL";
  const preset = await prisma.birdStatusPreset.create({
    data: {
      seasonId: b.seasonId ?? null, code: b.code, label: b.label, color: b.color ?? null,
      trigger, sortOrder: b.sortOrder ?? 0, isActive: b.isActive ?? true,
    },
  });
  return NextResponse.json({ preset }, { status: 201 });
}
