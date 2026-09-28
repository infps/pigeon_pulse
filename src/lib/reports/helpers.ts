import { prisma } from "@/lib/prisma";

export const YARDS_PER_MILE = 1760;

export function money(n: number | null | undefined): string {
  if (n == null) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function num(n: number | null | undefined, dp = 0): string {
  if (n == null) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-US");
}

export function dateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? "" : dt.toLocaleString("en-US");
}

export function clockTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime())
    ? ""
    : dt.toLocaleTimeString("en-US", { hour12: false });
}

/** HayLoft band format: federation-year-letters-number. */
export function bandOf(bird: {
  band1?: string | null;
  band2?: string | null;
  band3?: string | null;
  band4?: string | null;
  band?: string | null;
} | null | undefined): string {
  if (!bird) return "";
  const parts = [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean);
  return parts.length > 0 ? parts.join("-") : (bird.band ?? "");
}

export function breederName(
  b: { firstName?: string | null; lastName?: string | null } | null | undefined
): string {
  if (!b) return "";
  return `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim();
}

/** Flight time in minutes between release and arrival, or null. */
export function flightMinutes(
  start: Date | null | undefined,
  arrival: Date | null | undefined
): number | null {
  if (!start || !arrival) return null;
  const ms = arrival.getTime() - start.getTime();
  return ms > 0 ? ms / 60000 : null;
}

export function hhmmss(minutes: number | null): string {
  if (minutes == null) return "";
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Yards per minute — the velocity HayLoft printed on its result sheets. */
export function speedYPM(distanceMiles: number | null, minutes: number | null): number | null {
  if (!distanceMiles || !minutes || minutes <= 0) return null;
  return (distanceMiles * YARDS_PER_MILE) / minutes;
}

/** Season heading used as the subtitle on season-scoped reports. */
export async function seasonSubtitle(seasonId: number): Promise<string> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { name: true, startDate: true, endDate: true, event: { select: { name: true } } },
  });
  if (!season) return "";
  const range = `${date(season.startDate)} – ${date(season.endDate)}`;
  return [season.event?.name, season.name, range].filter(Boolean).join(" · ");
}

export async function raceSubtitle(raceId: number): Promise<string> {
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    select: {
      name: true,
      raceNumber: true,
      startTime: true,
      distance: true,
      raceType: { select: { name: true } },
      raceStation: { select: { name: true, miles: true } },
      seasonRel: { select: { name: true, event: { select: { name: true } } } },
    },
  });
  if (!race) return "";
  const miles = race.raceStation?.miles ?? race.distance;
  return [
    race.seasonRel?.event?.name,
    race.seasonRel?.name,
    race.name || (race.raceNumber != null ? `Race ${race.raceNumber}` : null),
    race.raceType?.name,
    race.raceStation?.name,
    miles ? `${num(miles)} mi` : null,
    race.startTime ? `released ${dateTime(race.startTime)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
