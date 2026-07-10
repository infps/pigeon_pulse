import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = Promise<{ eventId: string; id: string }>;

async function resolveParams(params: Params) {
  const { eventId: ep, id: ip } = await params;
  const eventId = parseInt(ep);
  const id = parseInt(ip);
  if (isNaN(eventId) || isNaN(id)) return null;
  return { eventId, id };
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid params" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { name, color, notes } = await request.json();

  const group = await prisma.eventBirdGroup.updateMany({
    where: { id: p.id, eventId: p.eventId },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(notes !== undefined && { notes }),
    },
  });

  if (group.count === 0) {
    return NextResponse.json({ message: "Group not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Updated" });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const p = await resolveParams(params);
  if (!p) return NextResponse.json({ message: "Invalid params" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.eventBirdGroup.deleteMany({
    where: { id: p.id, eventId: p.eventId },
  });

  if (result.count === 0) {
    return NextResponse.json({ message: "Group not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
