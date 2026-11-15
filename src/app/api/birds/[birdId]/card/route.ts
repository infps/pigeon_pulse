import { auth } from "@/lib/auth";
import { birdCard } from "@/lib/bird-card";
import { isStaff } from "@/lib/roles";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/birds/:birdId/card?seasonId=&eventId=
 * Everything about a bird for the bird popup (web and mobile). Admins see all;
 * the bird's breeder (and partners on its registration) see all of their own
 * bird; anyone else sees the bird and its race record only (lib/bird-card).
 */
export async function GET(request: Request, { params }: { params: Promise<{ birdId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { birdId } = await params;
  const id = parseInt(birdId, 10);
  if (Number.isNaN(id)) return NextResponse.json({ message: "Invalid bird ID" }, { status: 400 });
  const url = new URL(request.url);
  const num = (k: string) => {
    const v = parseInt(url.searchParams.get(k) ?? "", 10);
    return Number.isNaN(v) ? null : v;
  };

  try {
    const card = await birdCard(
      id,
      { userId: session.user.id, isAdmin: isStaff((session.user as { role?: string }).role) },
      { seasonId: num("seasonId"), eventId: num("eventId") }
    );
    if (!card) return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    return NextResponse.json(card);
  } catch (error) {
    console.error("Bird card failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
