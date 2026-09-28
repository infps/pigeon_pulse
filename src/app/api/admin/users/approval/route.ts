import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Registration approval queue.
 *
 * A decline never deletes the account — it flags it, and the flagged account
 * keeps guest-level access. That is the explicit requirement, and it is also
 * the safer behaviour: a wrong decline is reversible, a deletion is not.
 *
 * GET  — the queue, pending first
 * POST — decide: { userId, decision: "APPROVED" | "DECLINED" | "PENDING", note? }
 */
export async function GET(request: Request) {
  try {
    const guard = await requirePermission("users.approve");
    if ("error" in guard) return guard.error;

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const allowed = ["PENDING", "APPROVED", "DECLINED"] as const;
    const status = allowed.includes(statusParam as (typeof allowed)[number])
      ? (statusParam as (typeof allowed)[number])
      : undefined;

    const users = await prisma.user.findMany({
      where: status ? { approvalStatus: status } : {},
      orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        username: true,
        loftName: true,
        phoneNumber: true,
        country: true,
        state: true,
        city: true,
        role: true,
        status: true,
        approvalStatus: true,
        approvalDecidedAt: true,
        approvalDecidedBy: true,
        approvalNote: true,
        createdAt: true,
        breeder: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const counts = await prisma.user.groupBy({
      by: ["approvalStatus"],
      _count: { _all: true },
    });

    return NextResponse.json({
      users,
      counts: Object.fromEntries(counts.map((c) => [c.approvalStatus, c._count._all])),
    });
  } catch (error) {
    console.error("Failed to load approval queue:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const decideSchema = z.object({
  userId: z.string().min(1),
  decision: z.enum(["APPROVED", "DECLINED", "PENDING"]),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const guard = await requirePermission("users.approve");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const body = decideSchema.parse(await request.json());

    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, email: true, role: true, approvalStatus: true },
    });
    if (!target) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Only a superadmin may change another staff member's access, and nobody
    // may decide their own.
    if (target.id === session.user.id) {
      return NextResponse.json(
        { message: "You cannot change your own access." },
        { status: 400 }
      );
    }
    if (
      ["ADMIN", "SUPERADMIN"].includes(target.role) &&
      session.user.role !== "SUPERADMIN"
    ) {
      return NextResponse.json(
        { message: "Only a super admin can change an admin's access." },
        { status: 403 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: body.userId },
      data: {
        approvalStatus: body.decision,
        approvalDecidedAt: new Date(),
        approvalDecidedBy: session.user.id ?? null,
        approvalNote: body.note ?? null,
      },
      select: { id: true, email: true, approvalStatus: true, approvalNote: true },
    });

    const verb =
      body.decision === "APPROVED"
        ? "approved"
        : body.decision === "DECLINED"
          ? "declined and reduced to guest access"
          : "returned to the pending queue";

    return NextResponse.json({
      user: updated,
      message: `${target.email} ${verb}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "A user and a decision of APPROVED, DECLINED or PENDING are required." },
        { status: 400 }
      );
    }
    console.error("Approval decision failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
