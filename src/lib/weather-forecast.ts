import { WEATHER_TYPES, type WeatherType } from "./weather-constants";

// WMO weather interpretation codes (Open-Meteo) → app WeatherType labels.
function codeToWeather(code: number): WeatherType {
  if (code === 0) return WEATHER_TYPES.CLEAR_SKY;
  if (code === 1 || code === 2) return WEATHER_TYPES.PARTLY_CLOUDY;
  if (code === 3) return WEATHER_TYPES.OVERCAST;
  if (code === 45 || code === 48) return WEATHER_TYPES.FOG;
  if (code >= 51 && code <= 55) return WEATHER_TYPES.DRIZZLE;
  if (code === 56 || code === 57) return WEATHER_TYPES.SLEET;
  if (code === 61 || code === 80) return WEATHER_TYPES.LIGHT_RAIN;
  if (code === 63 || code === 81) return WEATHER_TYPES.RAIN;
  if (code === 65 || code === 82) return WEATHER_TYPES.HEAVY_RAIN;
  if (code === 66 || code === 67) return WEATHER_TYPES.SLEET;
  if (code === 71 || code === 77) return WEATHER_TYPES.LIGHT_SNOW;
  if (code === 73 || code === 75 || code === 85 || code === 86) return WEATHER_TYPES.SNOW;
  if (code >= 95) return WEATHER_TYPES.THUNDERSTORM;
  return WEATHER_TYPES.CLOUDY;
}

export type ReleaseForecast = {
  temperatureC: number;
  windKph: number;
  weather: WeatherType;
};

const FORECAST_HORIZON_DAYS = 16;

function isHistorical(localDateTime: string): boolean {
  const date = new Date(localDateTime.slice(0, 10));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FORECAST_HORIZON_DAYS);
  return date < cutoff;
}

// `when`: naive "YYYY-MM-DDTHH:MM" in the location's local time (browser form),
// or a Date (server) — then queried in GMT so the hour match is exact.
export async function fetchReleaseForecast(
  lat: number,
  lon: number,
  when: string | Date
): Promise<ReleaseForecast> {
  const utc = when instanceof Date;
  const localDateTime = utc ? when.toISOString() : when;
  const date = localDateTime.slice(0, 10); // YYYY-MM-DD
  if (date.length !== 10) throw new Error("Invalid release time");

  const historical = isHistorical(localDateTime);
  const baseUrl = historical
    ? `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}`
    : `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`;

  const url =
    baseUrl +
    `&hourly=temperature_2m,wind_speed_10m,weather_code` +
    `&wind_speed_unit=kmh&timezone=${utc ? "GMT" : "auto"}&start_date=${date}&end_date=${date}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      res.status === 400
        ? "No forecast for that date (likely beyond the 16-day horizon)"
        : `Forecast service error (${res.status})`
    );
  }

  const data = await res.json();
  const times: string[] = data?.hourly?.time ?? [];
  if (!times.length) throw new Error("No forecast available for that date");

  // Match the release hour; fall back to midday, else first slot.
  const targetHour = localDateTime.slice(0, 13); // YYYY-MM-DDTHH
  let idx = times.findIndex((t) => t.slice(0, 13) === targetHour);
  if (idx < 0) idx = times.findIndex((t) => t.endsWith("T12:00"));
  if (idx < 0) idx = 0;

  const temp = Number(data.hourly.temperature_2m?.[idx]);
  const wind = Number(data.hourly.wind_speed_10m?.[idx]);
  const code = Number(data.hourly.weather_code?.[idx]);
  if (Number.isNaN(temp) || Number.isNaN(wind)) {
    throw new Error("Forecast response missing values");
  }

  return {
    temperatureC: Math.round(temp * 10) / 10,
    windKph: Math.round(wind),
    weather: codeToWeather(code),
  };
}

export async function fetchSunriseSunset(
  lat: number,
  lon: number,
  date: string // "YYYY-MM-DD"
): Promise<{ sunrise: string; sunset: string }> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=sunrise,sunset&timezone=auto&start_date=${date}&end_date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sunrise/sunset fetch failed (${res.status})`);
  const data = await res.json();
  const sr: string | undefined = data?.daily?.sunrise?.[0];
  const ss: string | undefined = data?.daily?.sunset?.[0];
  if (!sr || !ss) throw new Error("No sunrise/sunset data");
  // Open-Meteo returns "YYYY-MM-DDTHH:MM" — extract HH:MM
  return { sunrise: sr.slice(11, 16), sunset: ss.slice(11, 16) };
}

// Server variant: sunrise/sunset as real instants for the local day containing `when`.
// Queries ±1 UTC day in the location tz, then shifts by utc_offset_seconds.
// ponytail: single offset per response; off by 1h on DST-switch days.
export async function fetchSunTimes(
  lat: number,
  lon: number,
  when: Date
): Promise<{ sunrise: Date; sunset: Date }> {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const t = when.getTime();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=sunrise,sunset&timezone=auto&start_date=${day(t - 864e5)}&end_date=${day(t + 864e5)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sunrise/sunset fetch failed (${res.status})`);
  const data = await res.json();
  const offsetMs = Number(data?.utc_offset_seconds ?? 0) * 1000;
  const idx = (data?.daily?.time ?? []).indexOf(day(t + offsetMs));
  const sr: string | undefined = data?.daily?.sunrise?.[idx];
  const ss: string | undefined = data?.daily?.sunset?.[idx];
  if (idx < 0 || !sr || !ss) throw new Error("No sunrise/sunset data");
  // Local "YYYY-MM-DDTHH:MM" → instant.
  const toUtc = (local: string) => new Date(Date.parse(`${local}:00Z`) - offsetMs);
  return { sunrise: toUtc(sr), sunset: toUtc(ss) };
}
