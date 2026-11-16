import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Server clock for scanner clients to measure their own drift. */
export function GET() {
  return NextResponse.json({ now: Date.now() });
}
