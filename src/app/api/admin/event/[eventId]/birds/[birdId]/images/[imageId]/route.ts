import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ eventId: string; birdId: string; imageId: string }> };

// DELETE /api/admin/event/[eventId]/birds/[birdId]/images/[imageId]
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
