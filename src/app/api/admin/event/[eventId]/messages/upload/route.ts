import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { uploadToR2, generateImageKey } from "@/lib/r2";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  await params;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ message: "File must be an image" }, { status: 400 });
    }

    const key = generateImageKey("events/messages", file.name);
    const result = await uploadToR2(file, key);

    return NextResponse.json({ url: result.url, key: result.key }, { status: 200 });
  } catch (error) {
    console.error("Error uploading message image:", error);
    return NextResponse.json({ message: "Upload failed" }, { status: 500 });
  }
}
