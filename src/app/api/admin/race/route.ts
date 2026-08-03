import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { haversine } from "@/lib/geo";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// Resolve a race's distance (miles, rounded int) from its launch station + event loft.
// Prefers the station's stored `miles`; falls back to haversine when coords exist.
async function deriveStationDistance(
  raceStationId: number,
  eventId: number,
): Promise<number | null> {
  const station = await prisma.raceStation.findUnique({ where: { id: raceStationId } });
  if (!station) return null;
  if (station.miles != null) return Math.round(station.miles);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { latitude: true, longitude: true },
  });
  if (
    event?.latitude != null &&
    event?.longitude != null &&
    station.latitude != null &&
    station.longitude != null
  ) {
    return Math.round(haversine(event.latitude, event.longitude, station.latitude, station.longitude).miles);
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const raceId = searchParams.get("raceId");

    // If raceId is provided, return single race
    if (raceId) {
      const race = await prisma.race.findUnique({
        where: { id: parseInt(raceId) },
        include: {
          raceType: true,
          seasonRel: { include: { event: { select: { id: true, name: true, shortName: true } } } },
          raceStation: true,
        },
      });

      if (!race) {
        return NextResponse.json(
          { message: "Race not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { race, message: "Race fetched successfully" },
        { status: 200 }
      );
    }

    const seasonIdParam = searchParams.get("seasonId");
    let whereClause: Record<string, any> = {};
    if (seasonIdParam) {
      whereClause = { seasonId: parseInt(seasonIdParam) };
    } else if (eventId) {
      const season = await prisma.season.findFirst({ where: { eventId: parseInt(eventId), isActive: true }, orderBy: { startDate: "desc" } });
      whereClause = season ? { seasonId: season.id } : {};
    }

    const races = await prisma.race.findMany({
      where: whereClause,
      include: {
        raceType: true,
        seasonRel: { include: { event: { select: { id: true, name: true, shortName: true } } } },
      },
      orderBy: {
        startTime: "desc",
      },
    });

    return NextResponse.json(
      { races, message: "Races fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching races:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      raceTypeId,
      eventId,
      raceNumber,
      name,
      description,
      distance,
      location,
      startTime,
      sunrise,
      sunset,
      arrivalTemperature,
      arrivalWind,
      arrivalWeather,
      temperature,
      wind,
      weather,
      isClosed,
      season,
      raceStationId,
    } = body;

    const event = await prisma.event.findUnique({
      where: { id: parseInt(eventId) },
    });

    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    const activeSeason = await prisma.season.findFirst({
      where: { eventId: parseInt(eventId), isActive: true },
      orderBy: { startDate: "desc" },
    });
    if (!activeSeason) {
      return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
    }

    const eventInventoryItems = await prisma.eventInventoryItem.findMany({
      where: { eventInventory: { seasonId: activeSeason.id } },
    });

    // Launch station selected → distance is derived (locked) from station→loft.
    const stationId = raceStationId ? parseInt(raceStationId) : null;
    const derivedDistance =
      stationId != null ? await deriveStationDistance(stationId, parseInt(eventId)) : null;

    const race = await prisma.$transaction(async (tx) => {
      const created = await tx.race.create({
        data: {
          raceTypeId: raceTypeId ? parseInt(raceTypeId) : null,
          seasonId: activeSeason.id,
          raceNumber: raceNumber ? parseInt(raceNumber) : null,
          name: name || "",
          description,
          raceStationId: stationId,
          distance: stationId != null ? derivedDistance : distance ? parseInt(distance) : null,
          location,
          startTime: startTime ? new Date(startTime) : null,
          sunrise: sunrise ? new Date(sunrise) : null,
          sunset: sunset ? new Date(sunset) : null,
          arrivalTemperature: arrivalTemperature != null ? String(arrivalTemperature) : null,
          arrivalWind,
          arrivalWeather,
          temperature: temperature != null ? String(temperature) : null,
          wind,
          weather,
          isClosed: isClosed ? 1 : 0,
          season: season ?? null,
        },
        include: {
          raceType: true,
          raceStation: true,
          seasonRel: { include: { event: { select: { id: true, name: true, shortName: true } } } },
        },
      });

      await tx.raceItem.createMany({
        data: eventInventoryItems.map((item) => ({
          raceId: created.id,
          inventoryItemId: item.id,
        })),
      });

      return created;
    });

    return NextResponse.json(
      { race, message: "Race created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating race:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { raceId, ...data } = body;

    if (!raceId) {
      return NextResponse.json(
        { message: "Race ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (data.raceTypeId) updateData.raceTypeId = parseInt(data.raceTypeId);
    if (data.raceNumber !== undefined) updateData.raceNumber = data.raceNumber ? parseInt(data.raceNumber) : null;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.location) updateData.location = data.location;

    // Launch station: persist + derive locked distance. Clearing keeps last distance.
    if (data.raceStationId !== undefined) {
      const stationId = data.raceStationId ? parseInt(data.raceStationId) : null;
      updateData.raceStationId = stationId;
      if (stationId != null) {
        const existing = await prisma.race.findUnique({
          where: { id: parseInt(raceId) },
          select: { seasonId: true },
        });
        const seasonForDist = existing?.seasonId
          ? await prisma.season.findUnique({ where: { id: existing.seasonId }, select: { eventId: true } })
          : null;
        const evId = seasonForDist?.eventId ?? null;
        if (evId != null) {
          const derived = await deriveStationDistance(stationId, evId);
          if (derived != null) updateData.distance = derived;
        }
      }
    } else if (data.distance) {
      updateData.distance = parseInt(data.distance);
    }
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.sunrise) updateData.sunrise = new Date(data.sunrise);
    if (data.sunset) updateData.sunset = new Date(data.sunset);
    if (data.arrivalTemperature !== undefined)
      updateData.arrivalTemperature =
        data.arrivalTemperature != null ? String(data.arrivalTemperature) : null;
    if (data.arrivalWind !== undefined) updateData.arrivalWind = data.arrivalWind;
    if (data.arrivalWeather !== undefined) updateData.arrivalWeather = data.arrivalWeather;
    if (data.temperature !== undefined)
      updateData.temperature = data.temperature != null ? String(data.temperature) : null;
    if (data.wind !== undefined) updateData.wind = data.wind;
    if (data.weather !== undefined) updateData.weather = data.weather;
    // Closed state is dual-tracked: `isClosed` flag + `status`/`endTime`.
    // Keep them in sync so unmarking "closed" actually re-opens the race.
    if (data.isClosed !== undefined) {
      if (data.isClosed) {
        updateData.isClosed = 1;
        updateData.status = "ENDED";
        if (!updateData.endTime) updateData.endTime = new Date();
      } else {
        updateData.isClosed = 0;
        updateData.endTime = null;
        // Re-open: STARTED if release time has passed, else REGISTERING.
        const start =
          updateData.startTime ??
          (
            await prisma.race.findUnique({
              where: { id: parseInt(raceId) },
              select: { startTime: true },
            })
          )?.startTime ??
          null;
        updateData.status =
          start && new Date(start).getTime() <= Date.now() ? "STARTED" : "REGISTERING";
      }
    }
    if (data.season !== undefined) updateData.season = data.season || null;

    const race = await prisma.race.update({
      where: { id: parseInt(raceId) },
      data: updateData,
      include: {
        raceType: true,
        raceStation: true,
        seasonRel: { include: { event: { select: { id: true, name: true, shortName: true } } } },
      },
    });

    return NextResponse.json(
      { race, message: "Race updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating race:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { raceId } = body;

    if (!raceId) {
      return NextResponse.json(
        { message: "Race ID is required" },
        { status: 400 }
      );
    }

    await prisma.race.delete({
      where: { id: parseInt(raceId) },
    });

    return NextResponse.json(
      { message: "Race deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting race:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
