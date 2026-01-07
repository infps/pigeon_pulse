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
        where: { raceId },
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

    const whereClause = eventId ? { eventId } : {};

    const races = await prisma.race.findMany({
      where: whereClause,
      include: {
        raceType: true,
        event: {
          select: {
            eventId: true,
            name: true,
            shortName: true,
          },
        },
      },
      orderBy: {
        releaseDate: "desc",
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
      name,
      description,
      distance,
      releaseStation,
      releaseDate,
      sunriseTime,
      sunsetTime,
      arrivalTemperature,
      arrivalWind,
      arrivalWeather,
      releaseTemperature,
      releaseWind,
      releaseWeather,
      isClosed,
    } = body;

    const event = await prisma.event.findUnique({
      where: { eventId },
    });

    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }
    const eventInventoryItems = await prisma.eventInventoryItem.findMany({
      where: { eventInventory:{
        eventId
      } },
    })
    const race = await prisma.race.create({
      data: {
        raceTypeId,
        eventId,
        name,
        description,
        distance: parseFloat(distance),
        releaseStation,
        releaseDate: new Date(releaseDate),
        sunriseTime: new Date(sunriseTime),
        sunsetTime: new Date(sunsetTime),
        arrivalTemperature: arrivalTemperature ? parseFloat(arrivalTemperature) : null,
        arrivalWind,
        arrivalWeather,
        releaseTemperature: releaseTemperature ? parseFloat(releaseTemperature) : null,
        releaseWind,
        releaseWeather,
        isClosed: isClosed ?? false,
      },
      include: {
        raceType: true,
        event: {
          select: {
            eventId: true,
            name: true,
            shortName: true,
          },
        },
      },
    });
    console.log(race)
    const raceItemsData = eventInventoryItems.map(item => ({
      raceId: race.raceId,
      birdId:item.birdId,
      eventInventoryItemId:item.eventInventoryItemId,
    }))
    await prisma.raceItem.createMany({
      data: eventInventoryItems.map(item => ({
        raceId: race.raceId,
        birdId:item.birdId,
        eventInventoryItemId:item.eventInventoryItemId,
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
    
    if (data.raceTypeId) updateData.raceTypeId = data.raceTypeId;
    if (data.eventId) updateData.eventId = data.eventId;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.distance) updateData.distance = parseFloat(data.distance);
    if (data.releaseStation) updateData.releaseStation = data.releaseStation;
    if (data.releaseDate) updateData.releaseDate = new Date(data.releaseDate);
    if (data.sunriseTime) updateData.sunriseTime = new Date(data.sunriseTime);
    if (data.sunsetTime) updateData.sunsetTime = new Date(data.sunsetTime);
    if (data.arrivalTemperature !== undefined) 
      updateData.arrivalTemperature = data.arrivalTemperature ? parseFloat(data.arrivalTemperature) : null;
    if (data.arrivalWind !== undefined) updateData.arrivalWind = data.arrivalWind;
    if (data.arrivalWeather !== undefined) updateData.arrivalWeather = data.arrivalWeather;
    if (data.releaseTemperature !== undefined) 
      updateData.releaseTemperature = data.releaseTemperature ? parseFloat(data.releaseTemperature) : null;
    if (data.releaseWind !== undefined) updateData.releaseWind = data.releaseWind;
    if (data.releaseWeather !== undefined) updateData.releaseWeather = data.releaseWeather;
    if (data.isClosed !== undefined) updateData.isClosed = data.isClosed;

    const race = await prisma.race.update({
      where: { raceId },
      data: updateData,
      include: {
        raceType: true,
        event: {
          select: {
            eventId: true,
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
      where: { raceId },
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
