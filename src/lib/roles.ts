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

/**
 * Approval gate.
 *
 * A pending or declined account is not blocked from signing in — the
 * requirement is that a decline leaves the account intact and reduces it to
 * what a guest sees. So reads stay open and only the acting surfaces close.
 *
 * Staff are exempt: an admin is vetted by virtue of being an admin.
 */
export function isApproved(user: { role?: string | null; approvalStatus?: string | null } | null | undefined): boolean {
  if (!user) return false;
  if (isStaff(user.role)) return true;
  return (user.approvalStatus ?? "APPROVED") === "APPROVED";
}

/**
 * Reject an action that requires a vetted account.
 *
 * Pending and declined get different wording because they are different
 * situations: one is waiting on somebody, the other has been answered.
 */
export function requireApproved(
  session: { user?: { role?: string | null; approvalStatus?: string | null } | null } | null | undefined
): NextResponse | null {
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (isApproved(session.user)) return null;

  const declined = session.user.approvalStatus === "DECLINED";
  return NextResponse.json(
    {
      message: declined
        ? "This account has been declined by the organizer, so it has guest access only. Contact the organizer if you think that is wrong."
        : "This account is waiting for an organizer to approve it. You can look around in the meantime.",
      approvalStatus: session.user.approvalStatus ?? "PENDING",
    },
    { status: 403 }
  );
}
