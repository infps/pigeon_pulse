/**
 * Permission checks for API routes.
 *
 * The catalog and resolution rules live in lib/permissions.ts; this is the part
 * that talks to the database and hands back a response.
 *
 * Grants are cached for a few seconds per user. A permission is read on nearly
 * every admin request, and without a cache a single page load would issue a
 * dozen identical queries. The window is short enough that revoking access
 * takes effect while the operator is still looking at the screen.
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ALL_PERMISSIONS,
  isSuperAdmin,
  resolveAll,
  resolvePermission,
  type PermissionGrant,
} from "@/lib/permissions";

const CACHE_MS = 10_000;

interface CachedGrants {
  roleGrants: PermissionGrant[];
  userGrants: PermissionGrant[];
  at: number;
}

const cache = new Map<string, CachedGrants>();

/** Drop a user's cached grants, so an edit is visible immediately to them. */
export function invalidatePermissionCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function loadGrants(userId: string, role: string): Promise<CachedGrants> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;

  const [roleRows, userRows] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { role },
      select: { permission: true, allowed: true },
    }),
    prisma.userPermission.findMany({
      where: { userId },
      select: { permission: true, allowed: true },
    }),
  ]);

  const entry: CachedGrants = { roleGrants: roleRows, userGrants: userRows, at: Date.now() };
  cache.set(userId, entry);
  return entry;
}

export interface Actor {
  id: string;
  role: string;
  approvalStatus?: string | null;
}

/** Everything a user is allowed to do, for a client that hides what it cannot use. */
export async function permissionsFor(actor: Actor): Promise<string[]> {
  if (isSuperAdmin(actor.role)) return ALL_PERMISSIONS.map((p) => p.code);
  const { roleGrants, userGrants } = await loadGrants(actor.id, actor.role);
  return resolveAll(actor.role, roleGrants, userGrants);
}

export async function can(actor: Actor, permission: string): Promise<boolean> {
  if (isSuperAdmin(actor.role)) return true;
  const { roleGrants, userGrants } = await loadGrants(actor.id, actor.role);
  return resolvePermission(actor.role, permission, roleGrants, userGrants);
}

export interface AuthorizedSession {
  // email is required rather than optional: better-auth always carries one, and
  // routes pass it straight to helpers that expect a string.
  user: { id: string; role: string; email: string; approvalStatus?: string | null };
}

/**
 * Guard a route on one permission.
 *
 * Returns the session when allowed, or a response to hand straight back. The
 * refusal names the permission, because "Forbidden" gives an operator nothing
 * to take to whoever hands out access.
 */
export async function requirePermission(
  permission: string
): Promise<{ session: AuthorizedSession } | { error: NextResponse }> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  const actor: Actor = {
    id: session.user.id,
    role: (session.user as { role?: string }).role ?? "BREEDER",
    approvalStatus: (session.user as { approvalStatus?: string }).approvalStatus,
  };

  if (await can(actor, permission)) {
    return { session: { user: { ...session.user, id: actor.id, role: actor.role } } };
  }

  return {
    error: NextResponse.json(
      {
        message: `You do not have permission to do this (${permission}). Ask a super admin to grant it.`,
        permission,
      },
      { status: 403 }
    ),
  };
}

/** Guard on any one of several permissions — for a screen that several roles reach. */
export async function requireAnyPermission(
  permissions: string[]
): Promise<{ session: AuthorizedSession } | { error: NextResponse }> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  const actor: Actor = {
    id: session.user.id,
    role: (session.user as { role?: string }).role ?? "BREEDER",
  };

  for (const permission of permissions) {
    if (await can(actor, permission)) {
      return { session: { user: { ...session.user, id: actor.id, role: actor.role } } };
    }
  }

  return {
    error: NextResponse.json(
      {
        message: `You do not have permission to do this. One of these is required: ${permissions.join(", ")}.`,
        permissions,
      },
      { status: 403 }
    ),
  };
}
