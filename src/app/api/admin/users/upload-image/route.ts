import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToR2, deleteFromR2, generateImageKey } from "@/lib/r2";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const oldKey = formData.get("oldKey") as string | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ message: "No file provided" }, { status: 400 });
  }

  if (oldKey) {
    try { await deleteFromR2(oldKey); } catch {}
  }

  const key = generateImageKey("breeders/profile", file.name);
  const { url } = await uploadToR2(file, key);

  return NextResponse.json({ url, key }, { status: 200 });
}
