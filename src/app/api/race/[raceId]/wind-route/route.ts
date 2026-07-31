import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { bearing, samplePoints } from "@/lib/map/geo";
import { resolveWind } from "@/lib/map/wind";
import type { RouteConfig, RouteSample } from "@/lib/map/types";

const WINDY_ENDPOINT = "https://api.windy.com/api/point-forecast/v2";
const GRID = 0.25;
const INTERVAL_MILES = 1;

function cellKey(lat: number, lon: number): string {
  return `${(Math.round(lat / GRID) * GRID).toFixed(2)},${(Math.round(lon / GRID) * GRID).toFixed(2)}`;
}

async function fetchCell(
  lat: number,
  lon: number,
  targetMs: number,
  apiKey: string
): Promise<{ tempK: number; windU: number; windV: number }> {
  const res = await fetch(WINDY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lat,
      lon,
      model: "gfs",
      parameters: ["wind", "temp"],
      levels: ["surface"],
      key: apiKey,
    }),
  });
  if (!res.ok) throw new Error(`Windy ${res.status}`);
  const data = await res.json() as {
    ts: number[];
    "wind_u-surface": number[];
    "wind_v-surface": number[];
    "temp-surface": number[];
  };
  // nearest forecast step to targetMs
  let best = 0, bestD = Infinity;
  data.ts.forEach((t, i) => { const d = Math.abs(t - targetMs); if (d < bestD) { bestD = d; best = i; } });
  return {
    tempK: data["temp-surface"][best],
    windU: data["wind_u-surface"][best],
    windV: data["wind_v-surface"][best],
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ raceId: string }> }
) {
  const { raceId: raceIdParam } = await params;
  const raceId = parseInt(raceIdParam);
  if (isNaN(raceId)) return NextResponse.json({ message: "Invalid race ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN", "BREEDER"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.WINDY_POINT_KEY;
  if (!apiKey) return NextResponse.json({ message: "WINDY_POINT_KEY not configured" }, { status: 500 });

  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      raceStation: true,
      raceType: { select: { name: true } },
      seasonRel: {
        select: {
          name: true,
          event: { select: { name: true, latitude: true, longitude: true } },
        },
      },
    },
  });

  if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });

  const stLat = race.raceStation?.latitude;
  const stLon = race.raceStation?.longitude;
  const evLat = race.seasonRel?.event?.latitude;
  const evLon = race.seasonRel?.event?.longitude;

  if (!stLat || !stLon || !evLat || !evLon) {
    return NextResponse.json(
      { message: "Race station or event location coordinates missing" },
      { status: 422 }
    );
  }

  const release = { lat: stLat, lon: stLon };
  const dest = { lat: evLat, lon: evLon };
  const flightBearing = bearing(release, dest);
  const pts = samplePoints(release, dest, INTERVAL_MILES);
  const targetMs = race.startTime ? new Date(race.startTime).getTime() : Date.now();

  // Dedupe by grid cell — 1 Windy call per unique 0.25° cell
  const keys = pts.map((p) => cellKey(p.lat, p.lon));
  const uniqueKeys = [...new Set(keys)];

  // Fetch unique cells with concurrency 5
  const cellCache: Record<string, { tempK: number; windU: number; windV: number }> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueKeys.length; i += 5) chunks.push(uniqueKeys.slice(i, i + 5));
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (k) => {
        const [lat, lon] = k.split(",").map(Number);
        cellCache[k] = await fetchCell(lat, lon, targetMs, apiKey);
      })
    );
  }

  const samples: RouteSample[] = pts.map((p, i) => {
    const w = cellCache[keys[i]];
    return {
      lat: p.lat,
      lon: p.lon,
      distMiles: p.distMiles,
      cell: keys[i],
      tempK: w.tempK,
      windU: w.windU,
      windV: w.windV,
      wind: resolveWind(w.windU, w.windV, flightBearing),
    };
  });

  const config: RouteConfig = {
    flightBearing,
    release: { lat: stLat, lon: stLon, label: race.raceStation?.name ?? "Release" },
    dest: { lat: evLat, lon: evLon, label: race.seasonRel?.event?.name ?? "Loft" },
    samples,
    meta: {
      eventName: race.seasonRel?.event?.name?.trim() || "Event",
      seasonName: race.seasonRel?.name?.trim() || "",
      raceName: race.name?.trim() || `Race ${race.id}`,
      raceTypeName: race.raceType?.name?.trim() || "",
      startTimeMs: race.startTime ? new Date(race.startTime).getTime() : null,
    },
  };

  return NextResponse.json(config);
}
