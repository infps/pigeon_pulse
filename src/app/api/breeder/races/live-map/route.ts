import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Races to plot on the global map: STARTED (live) + REGISTERING (upcoming, faded).
// Each needs a release station with coords and an event loft with coords.
export async function GET() {
  try {
    const races = await prisma.race.findMany({
      where: {
        status: { in: ["STARTED", "REGISTERING"] },
        raceStation: { latitude: { not: null }, longitude: { not: null } },
        seasonRel: { event: { latitude: { not: null }, longitude: { not: null } } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        distance: true,
        startTime: true,
        status: true,
        raceStation: {
          select: { name: true, latitude: true, longitude: true },
        },
        seasonRel: {
          select: { event: { select: { id: true, name: true, latitude: true, longitude: true } } },
        },
      },
      orderBy: { id: "desc" },
    });

    const out = races
      .filter(
        (r) =>
          r.raceStation?.latitude != null &&
          r.raceStation?.longitude != null &&
          r.seasonRel?.event?.latitude != null &&
          r.seasonRel?.event?.longitude != null,
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        distance: r.distance,
        startTime: r.startTime,
        status: r.status,
        station: {
          name: r.raceStation!.name,
          lat: r.raceStation!.latitude as number,
          lng: r.raceStation!.longitude as number,
        },
        loft: {
          eventId: r.seasonRel!.event!.id,
          name: r.seasonRel!.event!.name,
          lat: r.seasonRel!.event!.latitude as number,
          lng: r.seasonRel!.event!.longitude as number,
        },
      }));

    return NextResponse.json({ races: out, count: out.length });
  } catch (error) {
    console.error("Error fetching live-map races:", error);
    return NextResponse.json(
      { error: "Failed to fetch live-map races" },
      { status: 500 },
    );
  }
}
