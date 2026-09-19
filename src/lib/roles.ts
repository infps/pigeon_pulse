import { NextResponse } from "next/server";

/**
 * Role guards.
 *
 * BETTOR exists so someone can bet without keeping birds. The reference document
 * listed the role as "exists but not enforced", and the betting routes did
 * already admit it — what was missing was the other half: keeping a bettor out
 * of the surfaces that only make sense for someone who owns birds.
 *
 * Read-only breeder routes scope their results to the caller's own records, so a
 * bettor simply sees nothing there. These guards cover the write paths, where
 * "sees nothing" is not the same as "may not act".
 */

export type Role = "BREEDER" | "BETTOR" | "ADMIN" | "SUPERADMIN" | string;

export function isStaff(role: Role | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

/** Anyone who keeps birds: breeders and staff acting on their behalf. */
export function ownsBirds(role: Role | null | undefined): boolean {
  return role === "BREEDER" || isStaff(role);
}

export function isBettorOnly(role: Role | null | undefined): boolean {
  return role === "BETTOR";
}

/**
 * Reject a request that needs a bird-owning account.
 *
 * Returns a response to hand straight back, or null when the caller may proceed.
 * A bettor gets 403 with a reason rather than a bare 401, because the problem is
 * what the account is for, not whether they are signed in.
 */
export function requireBirdOwner(
  session: { user?: { role?: string | null } | null } | null | undefined
): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (isBettorOnly(session.user.role)) {
    return NextResponse.json(
      {
        message:
          "A bettor account can place bets but cannot keep birds or register for events. Ask an organizer to change your account to a breeder.",
      },
      { status: 403 }
    );
  }
  if (!ownsBirds(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return null;
}
