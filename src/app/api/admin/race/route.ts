import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

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
          event: true,
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

    const whereClause = eventId ? { eventId: parseInt(eventId) } : {};

    const races = await prisma.race.findMany({
      where: whereClause,
      include: {
        raceType: true,
        event: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
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
    const eventInventoryItems = await prisma.eventInventoryItem.findMany({
      where: { eventInventory:{
        eventId: parseInt(eventId)
      } },
    })
    const race = await prisma.race.create({
      data: {
        raceTypeId: raceTypeId ? parseInt(raceTypeId) : null,
        eventId: parseInt(eventId),
        raceNumber: raceNumber ? parseInt(raceNumber) : null,
        description,
        distance: distance ? parseInt(distance) : null,
        location,
        startTime: startTime ? new Date(startTime) : null,
        sunrise: sunrise ? new Date(sunrise) : null,
        sunset: sunset ? new Date(sunset) : null,
        arrivalTemperature: arrivalTemperature ?? null,
        arrivalWind,
        arrivalWeather,
        temperature: temperature ?? null,
        wind,
        weather,
        isClosed: isClosed ? 1 : 0,
      },
      include: {
        raceType: true,
        event: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    });
    console.log(race)
    await prisma.raceItem.createMany({
      data: eventInventoryItems.map(item => ({
        raceId: race.id,
        inventoryItemId: item.id,
      })),
    })

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
    if (data.eventId) updateData.eventId = parseInt(data.eventId);
    if (data.raceNumber !== undefined) updateData.raceNumber = data.raceNumber ? parseInt(data.raceNumber) : null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.distance) updateData.distance = parseInt(data.distance);
    if (data.location) updateData.location = data.location;
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.sunrise) updateData.sunrise = new Date(data.sunrise);
    if (data.sunset) updateData.sunset = new Date(data.sunset);
    if (data.arrivalTemperature !== undefined)
      updateData.arrivalTemperature = data.arrivalTemperature ?? null;
    if (data.arrivalWind !== undefined) updateData.arrivalWind = data.arrivalWind;
    if (data.arrivalWeather !== undefined) updateData.arrivalWeather = data.arrivalWeather;
    if (data.temperature !== undefined)
      updateData.temperature = data.temperature ?? null;
    if (data.wind !== undefined) updateData.wind = data.wind;
    if (data.weather !== undefined) updateData.weather = data.weather;
    if (data.isClosed !== undefined) updateData.isClosed = data.isClosed ? 1 : 0;

    const race = await prisma.race.update({
      where: { id: parseInt(raceId) },
      data: updateData,
      include: {
        raceType: true,
        event: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
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
