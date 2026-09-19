import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { permissionsFor } from "@/lib/authorize";

/**
 * What the signed-in user is allowed to do.
 *
 * The client uses this to hide controls it cannot use. It is a convenience, not
 * a security boundary — every route enforces its own permission, so a hidden
 * button and a forged request both end at the same check.
 *
 * Also consumed by the mobile apps to decide which shell to show.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.id) {
      return NextResponse.json(
        { signedIn: false, role: null, permissions: [] },
        { status: 200 }
      );
    }

    const role = (session.user as { role?: string }).role ?? "BREEDER";
    const approvalStatus = (session.user as { approvalStatus?: string }).approvalStatus ?? "APPROVED";

    const permissions = await permissionsFor({ id: session.user.id, role, approvalStatus });

    return NextResponse.json({
      signedIn: true,
      userId: session.user.id,
      role,
      approvalStatus,
      // A pending or declined account reads like a guest, so the client can say
      // so rather than silently showing an empty admin shell.
      isApproved: approvalStatus === "APPROVED" || role === "ADMIN" || role === "SUPERADMIN",
      permissions,
      isAdminCapable: permissions.length > 0,
    });
  } catch (error) {
    console.error("Failed to resolve permissions:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
