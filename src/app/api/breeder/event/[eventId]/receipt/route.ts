import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReceiptDocument } from "@/components/receipt-pdf";
import { buildReceiptData } from "@/lib/build-receipt-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { eventId } = await params;
  const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

  const inv = await prisma.eventInventory.findFirst({
    where: { eventId: parseInt(eventId), breederId: breeder.id },
    select: { id: true },
  });
  if (!inv) return NextResponse.json({ message: "Registration not found" }, { status: 404 });

  const data = await buildReceiptData(inv.id);
  if (!data) return NextResponse.json({ message: "Registration not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ReceiptDocument, { data }) as any);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt.pdf"`,
    },
  });
}
