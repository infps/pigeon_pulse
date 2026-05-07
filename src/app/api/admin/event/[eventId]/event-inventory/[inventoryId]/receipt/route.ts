import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReceiptDocument } from "@/components/receipt-pdf";
import { buildReceiptData, getBreederLastName } from "@/lib/build-receipt-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; inventoryId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { inventoryId } = await params;
  const invId = parseInt(inventoryId);
  const data = await buildReceiptData(invId);
  if (!data) return NextResponse.json({ message: "Not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ReceiptDocument, { data }) as any);
  const lastName = await getBreederLastName(invId);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${lastName}.pdf"`,
    },
  });
}
