import { auth } from "@/lib/auth";
import { getOrCreateBreeder } from "@/lib/get-or-create-breeder";
import { prisma } from "@/lib/prisma";
import { uploadToR2, deleteFromR2, generateImageKey } from "@/lib/r2";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const birdIdInt = parseInt(birdId);
    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

    const bird = await prisma.bird.findUnique({ where: { id: birdIdInt } });
    if (!bird) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }
    if (bird.breederId !== breeder.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return NextResponse.json({ message: "No image provided" }, { status: 400 });
    }

    // Delete old image if exists
    if (bird.imageKey) {
      try {
        await deleteFromR2(bird.imageKey);
      } catch {
        // Ignore deletion errors for old image
      }
    }

    const key = generateImageKey("birds", file.name);
    const { url } = await uploadToR2(file, key);

    const updated = await prisma.bird.update({
      where: { id: birdIdInt },
      data: { image: url, imageKey: key },
    });

    return NextResponse.json({
      image: updated.image,
      imageKey: updated.imageKey,
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading bird image:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { birdId } = await params;
    const birdIdInt = parseInt(birdId);
    const breeder = await getOrCreateBreeder(session.user.id, session.user.email, session.user.name);

    const bird = await prisma.bird.findUnique({ where: { id: birdIdInt } });
    if (!bird) {
      return NextResponse.json({ message: "Bird not found" }, { status: 404 });
    }
    if (bird.breederId !== breeder.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (bird.imageKey) {
      await deleteFromR2(bird.imageKey);
    }

    await prisma.bird.update({
      where: { id: birdIdInt },
      data: { image: null, imageKey: null },
    });

    return NextResponse.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting bird image:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
