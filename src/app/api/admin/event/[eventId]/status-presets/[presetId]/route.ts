import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function guard() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user && ["ADMIN", "SUPERADMIN"].includes(session.user.role) ? session : null;
}

// PATCH — edit label/color/trigger/sortOrder/isActive.
export async function PATCH(req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  if (!(await guard())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { presetId } = await params;
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["code", "label", "color", "trigger", "sortOrder", "isActive"]) if (b[k] !== undefined) data[k] = b[k];
  const preset = await prisma.birdStatusPreset.update({ where: { id: parseInt(presetId) }, data });
  return NextResponse.json({ preset });
}

// DELETE — remove a preset (nulls any RaceItem pointing at it via FK set-null? no FK cascade -> detach first).
export async function DELETE(_req: Request, { params }: { params: Promise<{ presetId: string }> }) {
  if (!(await guard())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { presetId } = await params;
  const id = parseInt(presetId);
  await prisma.raceItem.updateMany({ where: { displayStatusId: id }, data: { displayStatusId: null } });
  await prisma.birdStatusPreset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
