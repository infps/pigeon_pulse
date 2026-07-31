import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const { searchParams } = new URL(request.url);
  const seasonIdParam = searchParams.get("seasonId");
  if (seasonIdParam) return parseInt(seasonIdParam);
  const activeSeason = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (!activeSeason) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return activeSeason.id;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(request, eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  const [config, event] = await Promise.all([
    prisma.calcuttaConfig.findUnique({ where: { seasonId } }),
    prisma.event.findUnique({ where: { id: eventId }, select: { raceFormat: true } }),
  ]);

  return NextResponse.json({
    config: config
      ? { ...config, pricePerBird: Number(config.pricePerBird) }
      : null,
    raceFormat: event?.raceFormat ?? null,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(request, eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  const body = await request.json();
  const {
    pricePerBird,
    targetGroupSize = 15,
    biddingDuration = 120,
    antiSnipeDuration = 10,
    bidRaiseOptions = [],
    youtubeStreamUrl,
  } = body;

  if (pricePerBird == null || isNaN(Number(pricePerBird))) {
    return NextResponse.json({ message: "pricePerBird required" }, { status: 400 });
  }

  const [config] = await prisma.$transaction([
    prisma.calcuttaConfig.upsert({
      where: { seasonId },
      create: {
        seasonId,
        pricePerBird: Number(pricePerBird),
        targetGroupSize,
        biddingDuration,
        antiSnipeDuration,
        bidRaiseOptions,
        youtubeStreamUrl: youtubeStreamUrl || null,
      },
      update: {
        pricePerBird: Number(pricePerBird),
        targetGroupSize,
        biddingDuration,
        antiSnipeDuration,
        bidRaiseOptions,
        youtubeStreamUrl: youtubeStreamUrl || null,
      },
    }),
    prisma.event.update({
      where: { id: eventId },
      data: { raceFormat: "CALCUTTA" },
    }),
  ]);

  return NextResponse.json({ config: { ...config, pricePerBird: Number(config.pricePerBird) } });
}
