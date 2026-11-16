import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchReleaseForecast, fetchSunTimes } from "@/lib/weather-forecast";

/**
 * Fill a race's weather from Open-Meteo. Never throws.
 *  - default: release wx @ station for startTime, arrival wx @ loft for
 *    (endTime ?? startTime), sunrise/sunset @ station if blank.
 *  - arrival: true → arrival block only.
 *  - overwrite: true → replace existing weather fields (never sunrise/sunset).
 * Without overwrite only blank fields are written.
 */
export async function fillRaceWeather(
  raceId: number,
  opts: { arrival?: boolean; overwrite?: boolean } = {}
): Promise<void> {
  try {
    const race = await prisma.race.findUnique({
      where: { id: raceId },
      select: {
        startTime: true,
        endTime: true,
        sunrise: true,
        sunset: true,
        temperature: true,
        weather: true,
        wind: true,
        arrivalTemperature: true,
        arrivalWeather: true,
        arrivalWind: true,
        raceStation: { select: { latitude: true, longitude: true } },
        seasonRel: { select: { event: { select: { latitude: true, longitude: true } } } },
      },
    });
    if (!race?.startTime) return;

    const blank = (v: string | null) => opts.overwrite || v == null || v === "";
    const st = race.raceStation;
    const loft = race.seasonRel?.event;
    const data: Prisma.RaceUpdateInput = {};
    const jobs: Promise<void>[] = [];

    if (!opts.arrival && st?.latitude != null && st.longitude != null) {
      if (blank(race.temperature) || blank(race.weather) || blank(race.wind)) {
        jobs.push(
          fetchReleaseForecast(st.latitude, st.longitude, race.startTime).then((f) => {
            if (blank(race.temperature)) data.temperature = String(f.temperatureC);
            if (blank(race.weather)) data.weather = f.weather;
            if (blank(race.wind)) data.wind = `${f.windKph} km/h`;
          })
        );
      }
      if (race.sunrise == null || race.sunset == null) {
        jobs.push(
          fetchSunTimes(st.latitude, st.longitude, race.startTime).then((s) => {
            if (race.sunrise == null) data.sunrise = s.sunrise;
            if (race.sunset == null) data.sunset = s.sunset;
          })
        );
      }
    }

    if (
      loft?.latitude != null &&
      loft.longitude != null &&
      (blank(race.arrivalTemperature) || blank(race.arrivalWeather) || blank(race.arrivalWind))
    ) {
      jobs.push(
        fetchReleaseForecast(loft.latitude, loft.longitude, race.endTime ?? race.startTime).then((f) => {
          if (blank(race.arrivalTemperature)) data.arrivalTemperature = String(f.temperatureC);
          if (blank(race.arrivalWeather)) data.arrivalWeather = f.weather;
          if (blank(race.arrivalWind)) data.arrivalWind = `${f.windKph} km/h`;
        })
      );
    }

    for (const r of await Promise.allSettled(jobs)) {
      if (r.status === "rejected") console.warn(`[weather] race ${raceId}:`, r.reason);
    }
    if (Object.keys(data).length) await prisma.race.update({ where: { id: raceId }, data });
  } catch (e) {
    console.error(`[weather] fillRaceWeather failed for race ${raceId}:`, e);
  }
}
