import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { raceId } = await params;
  const groups = await prisma.arrivalGroup.findMany({
    where: { raceId: parseInt(raceId) },
    orderBy: { arrivalTimeStart: "asc" },
  });
  return NextResponse.json({ groups });
}

export async function POST(req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { raceId } = await params;
  const body = await req.json();
  const { name, arrivalTimeStart, arrivalTimeEnd } = body;

  const group = await prisma.arrivalGroup.create({
    data: {
      raceId: parseInt(raceId),
      name: name || null,
      arrivalTimeStart: arrivalTimeStart ? new Date(arrivalTimeStart) : null,
      arrivalTimeEnd: arrivalTimeEnd ? new Date(arrivalTimeEnd) : null,
    },
  });
  return NextResponse.json({ group }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ message: "id required" }, { status: 400 });

  await prisma.arrivalGroup.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: "Deleted" });
}
