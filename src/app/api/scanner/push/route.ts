import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rfidTag, scannerId = "python-client" } = body;

    if (!rfidTag || typeof rfidTag !== "string" || !rfidTag.trim()) {
      return NextResponse.json({ message: "rfidTag required" }, { status: 400 });
    }

    await prisma.rfidScan.create({
      data: {
        rfidTag: rfidTag.trim(),
        scannerId,
        processed: false,
      },
    });

    return NextResponse.json({ message: "Scan stored" });
  } catch (error) {
    console.error("Error storing scan:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
