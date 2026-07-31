import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rfidTag, scannerId = "python-client" } = body;

    if (!rfidTag || typeof rfidTag !== "string" || !rfidTag.trim()) {
      return NextResponse.json({ message: "rfidTag required" }, { status: 400 });
    }

    const deviceIp = getClientIp(request);

    await prisma.rfidScan.create({
      data: {
        rfidTag: rfidTag.trim(),
        scannerId,
        deviceIp,
        processed: false,
      },
    });

    return NextResponse.json({ message: "Scan stored" });
  } catch (error) {
    console.error("Error storing scan:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
