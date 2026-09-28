import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidatePermissionCache, requirePermission } from "@/lib/authorize";
import {
  ALL_PERMISSIONS,
  MODULES,
  hasDefault,
  isKnownPermission,
  resolveAll,
} from "@/lib/permissions";

const ASSIGNABLE_ROLES = ["ADMIN", "BREEDER", "BETTOR"] as const;

/**
 * The permission matrix.
 *
 * GET returns the catalog, the role rules, and every account that carries a
 * personal override, so the screen can show the whole picture in one load.
 *
 * SUPERADMIN is not listed as an editable role: it is a bypass rather than a
 * permission set, which is what stops somebody removing their own ability to
 * hand out permissions and locking the system.
 */
export async function GET(request: Request) {
  const guard = await requirePermission("users.permissions");
  if ("error" in guard) return guard.error;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const [roleRows, userRows] = await Promise.all([
      prisma.rolePermission.findMany({ select: { role: true, permission: true, allowed: true } }),
      userId
        ? prisma.userPermission.findMany({
            where: { userId },
            select: { userId: true, permission: true, allowed: true },
          })
        : prisma.userPermission.findMany({
            select: { userId: true, permission: true, allowed: true },
          }),
    ]);

    // Roles with their effective answer per permission, so the UI never has to
    // re-implement the resolution rules.
    const roles = ASSIGNABLE_ROLES.map((role) => ({
      role,
      permissions: ALL_PERMISSIONS.map((p) => {
        const rule = roleRows.find((r) => r.role === role && r.permission === p.code);
        return {
          code: p.code,
          allowed: rule ? rule.allowed : hasDefault(role, p.code),
          explicit: rule != null,
          byDefault: hasDefault(role, p.code),
        };
      }),
    }));

    // Only accounts that actually carry an override, so the list stays short.
    const overriddenIds = [...new Set(userRows.map((u) => u.userId))];
    const users = overriddenIds.length
      ? await prisma.user.findMany({
          where: { id: { in: overriddenIds } },
          select: { id: true, name: true, lastName: true, email: true, role: true },
        })
      : [];

    return NextResponse.json({
      modules: MODULES,
      roles,
      overrides: users.map((u) => ({
        user: u,
        permissions: userRows
          .filter((r) => r.userId === u.id)
          .map((r) => ({ code: r.permission, allowed: r.allowed })),
        effective: resolveAll(
          u.role,
          roleRows.filter((r) => r.role === u.role),
          userRows.filter((r) => r.userId === u.id)
        ),
      })),
    });
  } catch (error) {
    console.error("Failed to load permissions:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

const updateSchema = z.object({
  /** Exactly one of these. */
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  userId: z.string().min(1).optional(),
  changes: z
    .array(
      z.object({
        permission: z.string().min(1),
        // null clears the rule and falls back to the layer beneath.
        allowed: z.boolean().nullable(),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const guard = await requirePermission("users.permissions");
  if ("error" in guard) return guard.error;

  try {
    const body = updateSchema.parse(await request.json());

    if ((body.role == null) === (body.userId == null)) {
      return NextResponse.json(
        { message: "Give either a role or a user, not both." },
        { status: 400 }
      );
    }

    const unknown = body.changes.filter((c) => !isKnownPermission(c.permission));
    if (unknown.length > 0) {
      return NextResponse.json(
        { message: `Unknown permission: ${unknown.map((u) => u.permission).join(", ")}` },
        { status: 400 }
      );
    }

    const actorId = guard.session.user.id;

    if (body.role) {
      for (const change of body.changes) {
        if (change.allowed === null) {
          await prisma.rolePermission.deleteMany({
            where: { role: body.role, permission: change.permission },
          });
          continue;
        }
        await prisma.rolePermission.upsert({
          where: { role_permission: { role: body.role, permission: change.permission } },
          create: {
            role: body.role,
            permission: change.permission,
            allowed: change.allowed,
            updatedBy: actorId,
          },
          update: { allowed: change.allowed, updatedAt: new Date(), updatedBy: actorId },
        });
      }
      // A role change affects everyone holding it, so the whole cache goes.
      invalidatePermissionCache();
      return NextResponse.json({
        message: `${body.changes.length} permission${body.changes.length === 1 ? "" : "s"} updated for ${body.role}.`,
      });
    }

    const target = await prisma.user.findUnique({
      where: { id: body.userId! },
      select: { id: true, email: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    // A superadmin bypasses permissions entirely, so an override on one would
    // be recorded and then ignored — misleading rather than harmless.
    if (target.role === "SUPERADMIN") {
      return NextResponse.json(
        { message: "Super admins already have every permission; overrides do not apply to them." },
        { status: 400 }
      );
    }

    for (const change of body.changes) {
      if (change.allowed === null) {
        await prisma.userPermission.deleteMany({
          where: { userId: target.id, permission: change.permission },
        });
        continue;
      }
      await prisma.userPermission.upsert({
        where: { userId_permission: { userId: target.id, permission: change.permission } },
        create: {
          userId: target.id,
          permission: change.permission,
          allowed: change.allowed,
          updatedBy: actorId,
        },
        update: { allowed: change.allowed, updatedAt: new Date(), updatedBy: actorId },
      });
    }

    invalidatePermissionCache(target.id);

    return NextResponse.json({
      message: `${body.changes.length} permission${body.changes.length === 1 ? "" : "s"} updated for ${target.email}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "A role or user and at least one change are required." },
        { status: 400 }
      );
    }
    console.error("Failed to update permissions:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
