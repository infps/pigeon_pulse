import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q?.trim()) return NextResponse.json([]);

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PigeonPulse/1.0 (pigeon racing management)",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}
