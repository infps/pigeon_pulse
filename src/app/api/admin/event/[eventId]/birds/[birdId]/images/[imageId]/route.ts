import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; birdId: string; imageId: string }> };

// DELETE /api/admin/event/[eventId]/birds/[birdId]/images/[imageId]
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const guard = await requirePermission("events.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { imageId } = await params;
    const image = await prisma.birdImage.findUnique({ where: { id: parseInt(imageId) } });
    if (!image) return NextResponse.json({ message: "Image not found" }, { status: 404 });

    try {
      await deleteFromR2(image.s3Key);
    } catch {
      // R2 deletion failure should not block DB cleanup
    }

    await prisma.birdImage.delete({ where: { id: image.id } });

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Error deleting bird image:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
