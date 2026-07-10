import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const schema = z.object({
  code:  z.number().int().positive(),
  label: z.string().min(1),
  color: z.string().optional(),
});

export async function GET() {
  try {
    const codes = await prisma.birdStatusCode.findMany({
      orderBy: { code: "asc" },
    });
    return NextResponse.json({ codes });
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

async function requireSuperAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "SUPERADMIN") return null;
  return session;
}

export async function POST(request: Request) {
  try {
    if (!await requireSuperAdmin())
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const data = schema.parse(body);

    const existing = await prisma.birdStatusCode.findUnique({ where: { code: data.code } });
    if (existing)
      return NextResponse.json({ message: `Code ${data.code} already exists` }, { status: 409 });

    const created = await prisma.birdStatusCode.create({ data });
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ message: "Validation error", errors: e.issues }, { status: 400 });
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!await requireSuperAdmin())
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, ...rest } = body;
    if (!id)
      return NextResponse.json({ message: "ID required" }, { status: 400 });

    const data = schema.parse(rest);
    const updated = await prisma.birdStatusCode.update({ where: { id: parseInt(id) }, data });
    return NextResponse.json({ code: updated });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ message: "Validation error", errors: e.issues }, { status: 400 });
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!await requireSuperAdmin())
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await request.json();
    if (!id)
      return NextResponse.json({ message: "ID required" }, { status: 400 });

    await prisma.birdStatusCode.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ message: "Deleted" });
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
