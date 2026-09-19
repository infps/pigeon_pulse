import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { entryInvoice, prizeStatements, seasonLedger } from "@/lib/accounting";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Accounting reports.
 *
 *   ?view=ledger                     one line per registration, both directions
 *   ?view=unpaid                     only those who owe
 *   ?view=earned                     only those owed money
 *   ?view=prizes                     every payout across the season
 *   ?view=invoice&inventoryId=123    one registration's entry invoice
 *
 * Reports over money already recorded — nothing here stores a second copy, so
 * no figure can drift from the payment it came from.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await params;
    const eventIdInt = parseInt(eventId, 10);
    if (Number.isNaN(eventIdInt)) {
      return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "ledger";

    if (view === "invoice") {
      const inventoryId = parseInt(url.searchParams.get("inventoryId") ?? "", 10);
      if (Number.isNaN(inventoryId)) {
        return NextResponse.json(
          { message: "An inventoryId is required for an invoice" },
          { status: 400 }
        );
      }
      const invoice = await entryInvoice(inventoryId);
      if (!invoice) {
        return NextResponse.json({ message: "Registration not found" }, { status: 404 });
      }
      return NextResponse.json({ view, invoice });
    }

    const seasonParam = url.searchParams.get("seasonId");
    let seasonId = seasonParam ? parseInt(seasonParam, 10) : NaN;
    if (Number.isNaN(seasonId)) {
      const active = await prisma.season.findFirst({
        where: { eventId: eventIdInt, isActive: true },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });
      if (!active) {
        return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
      }
      seasonId = active.id;
    }

    if (view === "prizes") {
      const prizes = await prizeStatements(seasonId);
      return NextResponse.json({ view, seasonId, ...prizes });
    }

    const ledger = await seasonLedger(seasonId);

    if (view === "unpaid") {
      const lines = ledger.lines.filter((l) => l.balance > 0);
      return NextResponse.json({
        view,
        seasonId,
        lines,
        total: Math.round(lines.reduce((s, l) => s + l.balance, 0) * 100) / 100,
      });
    }

    if (view === "earned") {
      const lines = ledger.lines.filter((l) => l.owedOut > 0);
      return NextResponse.json({
        view,
        seasonId,
        lines,
        total: Math.round(lines.reduce((s, l) => s + l.owedOut, 0) * 100) / 100,
      });
    }

    return NextResponse.json({ view: "ledger", ...ledger });
  } catch (error) {
    console.error("Accounting report failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
