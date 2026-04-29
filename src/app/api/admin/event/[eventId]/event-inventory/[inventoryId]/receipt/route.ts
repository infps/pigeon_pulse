import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReceiptDocument, type ReceiptData } from "@/components/receipt-pdf";

const METHOD_LABELS: Record<number, string> = { 0: "Cash", 1: "Credit Card", 2: "PayPal", 3: "Bank Transfer" };
const TYPE_LABELS: Record<number, string> = { 0: "Perch Fee", 1: "Per Bird Fee", 2: "Races Fee", 3: "Payouts", 4: "Other" };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; inventoryId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { eventId, inventoryId } = await params;

  const inv = await prisma.eventInventory.findFirst({
    where: { id: parseInt(inventoryId), eventId: parseInt(eventId) },
    include: {
      breeder: true,
      event: true,
      items: { include: { bird: true } },
      payments: true,
    },
  });

  if (!inv) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const data: ReceiptData = {
    eventName: inv.event?.name ?? "Event",
    eventDate: inv.event?.eventDate?.toISOString() ?? null,
    breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
    breederEmail: inv.breeder?.email ?? "",
    breederPhone: inv.breeder?.phone ?? "",
    loftName: inv.loft ?? "",
    birds: (inv.items ?? []).map((item) => ({
      birdNo: item.birdNo,
      band: item.bird?.band ?? null,
      birdName: item.bird?.birdName ?? null,
      color: item.bird?.color ?? null,
      sex: item.bird?.sex ?? null,
      totalFee: (item.entryFeeValue ?? 0) + (item.perchFeeValue ?? 0) + (item.raceFeeValue ?? 0) + (item.hotSpotFeeValue ?? 0),
    })),
    payments: (inv.payments ?? []).map((p) => ({
      date: p.paymentDate?.toISOString() ?? null,
      type: typeof p.paymentType === "number" ? (TYPE_LABELS[p.paymentType] ?? "Other") : String(p.paymentType ?? ""),
      method: typeof p.paymentMethod === "number" ? (METHOD_LABELS[p.paymentMethod] ?? "Other") : String(p.paymentMethod ?? ""),
      amount: p.paymentValue ?? 0,
    })),
    totalOwed: (inv.items ?? []).reduce((s, i) => s + (i.entryFeeValue ?? 0) + (i.perchFeeValue ?? 0) + (i.raceFeeValue ?? 0) + (i.hotSpotFeeValue ?? 0), 0),
    totalPaid: (inv.payments ?? []).reduce((s, p) => s + (p.paymentValue ?? 0), 0),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ReceiptDocument, { data }) as any);
  const lastName = inv.breeder?.lastName ?? "breeder";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${lastName}.pdf"`,
    },
  });
}
