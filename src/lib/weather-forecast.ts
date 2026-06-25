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

/**
 * Predicted weather at a liberation point and release time.
 * Uses Open-Meteo (free, no API key — same keyless pattern as the Nominatim
 * geocoder already used in the map search).
 *
 * @param lat liberation point latitude
 * @param lon liberation point longitude
 * @param localDateTime datetime-local string, e.g. "2026-06-30T05:00" (wall time)
 *
 * Open-Meteo forecast horizon is ~16 days; dates beyond that throw.
 */
export async function fetchReleaseForecast(
  lat: number,
  lon: number,
  localDateTime: string
): Promise<ReleaseForecast> {
  const date = localDateTime.slice(0, 10); // YYYY-MM-DD
  if (date.length !== 10) throw new Error("Invalid release time");

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,wind_speed_10m,weather_code` +
    `&wind_speed_unit=kmh&timezone=auto&start_date=${date}&end_date=${date}`;

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
