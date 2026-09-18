import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { returnBird } from "@/lib/bird-substitution";

/**
 * Send a bird home — port of HayLoft's RETURN_BIRD.
 *
 * Stamps the departure date and frees the RFID tag for reuse.
 *
 * POST body: { returnDate?: string }  — defaults to now.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventInventoryItemId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventInventoryItemId } = await params;
    const itemId = parseInt(eventInventoryItemId, 10);
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ message: "Invalid entry ID" }, { status: 400 });
    }

    let returnDate = new Date();
    try {
      const body = await request.json();
      if (body?.returnDate) {
        const parsed = new Date(body.returnDate);
        if (!Number.isNaN(parsed.getTime())) returnDate = parsed;
      }
    } catch {
      // No body — default to now.
    }

    const result = await returnBird(itemId, returnDate);

    return NextResponse.json({
      result,
      message: "Bird marked as returned and its RFID tag released.",
    });
  } catch (error) {
    console.error("Return bird failed:", error);
    return NextResponse.json({ message: "Failed to mark the bird as returned" }, { status: 500 });
  }
}
