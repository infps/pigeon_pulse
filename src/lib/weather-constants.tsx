export const WEATHER_TYPES = {
  CLEAR_SKY: "Clear Sky",
  PARTLY_CLOUDY: "Partly Cloudy",
  CLOUDY: "Cloudy",
  OVERCAST: "Overcast",
  LIGHT_RAIN: "Light Rain",
  RAIN: "Rain",
  HEAVY_RAIN: "Heavy Rain",
  THUNDERSTORM: "Thunderstorm",
  DRIZZLE: "Drizzle",
  SNOW: "Snow",
  LIGHT_SNOW: "Light Snow",
  SLEET: "Sleet",
  FOG: "Fog",
  MIST: "Mist",
  HAZE: "Haze",
  WINDY: "Windy",
  SUNNY: "Sunny",
} as const;

export type WeatherType = typeof WEATHER_TYPES[keyof typeof WEATHER_TYPES];

export const WEATHER_OPTIONS = Object.values(WEATHER_TYPES);

// Weather SVG Icons
export const WeatherIcons = {
  [WEATHER_TYPES.CLEAR_SKY]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2"/>
      <path d="M12 20v2"/>
      <path d="m4.93 4.93 1.41 1.41"/>
      <path d="m17.66 17.66 1.41 1.41"/>
      <path d="M2 12h2"/>
      <path d="M20 12h2"/>
      <path d="m6.34 17.66-1.41 1.41"/>
      <path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  ),
  [WEATHER_TYPES.SUNNY]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2"/>
      <path d="M12 20v2"/>
      <path d="m4.93 4.93 1.41 1.41"/>
      <path d="m17.66 17.66 1.41 1.41"/>
      <path d="M2 12h2"/>
      <path d="M20 12h2"/>
      <path d="m6.34 17.66-1.41 1.41"/>
      <path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  ),
  [WEATHER_TYPES.PARTLY_CLOUDY]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 2v2"/>
      <path d="m4.93 4.93 1.41 1.41"/>
      <path d="M20 12h2"/>
      <path d="m19.07 4.93-1.41 1.41"/>
      <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/>
      <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>
    </svg>
  ),
  [WEATHER_TYPES.CLOUDY]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
    </svg>
  ),
  [WEATHER_TYPES.OVERCAST]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
    </svg>
  ),
  [WEATHER_TYPES.LIGHT_RAIN]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="M16 14v2"/>
      <path d="M12 14v4"/>
      <path d="M8 14v2"/>
    </svg>
  ),
  [WEATHER_TYPES.RAIN]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="M16 14v6"/>
      <path d="M8 14v6"/>
      <path d="M12 16v6"/>
    </svg>
  ),
  [WEATHER_TYPES.HEAVY_RAIN]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="M16 14v6"/>
      <path d="M8 14v6"/>
      <path d="M12 14v6"/>
      <path d="M10 18v2"/>
      <path d="M14 18v2"/>
    </svg>
  ),
  [WEATHER_TYPES.THUNDERSTORM]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="M13 13 9 20l2-5-4-2 4-7 2 5 4 2z"/>
    </svg>
  ),
  [WEATHER_TYPES.DRIZZLE]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="M8 19v1"/>
      <path d="M8 14v1"/>
      <path d="M16 19v1"/>
      <path d="M16 14v1"/>
      <path d="M12 21v1"/>
      <path d="M12 16v1"/>
    </svg>
  ),
  [WEATHER_TYPES.SNOW]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="M2 17h.01"/>
      <path d="m10 16 .5 .5"/>
      <path d="m14 16-.5 .5"/>
      <path d="M22 17h-.01"/>
      <path d="m10 20 .5-.5"/>
      <path d="m14 20-.5-.5"/>
    </svg>
  ),
  [WEATHER_TYPES.LIGHT_SNOW]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="m10 16 .5 .5"/>
      <path d="m14 16-.5 .5"/>
    </svg>
  ),
  [WEATHER_TYPES.SLEET]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
      <path d="M8 16v2"/>
      <path d="M16 16v2"/>
      <path d="m12 16 .5 .5"/>
    </svg>
  ),
  [WEATHER_TYPES.FOG]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
      <path d="M16 17H7"/>
      <path d="M17 21H9"/>
    </svg>
  ),
  [WEATHER_TYPES.MIST]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M5 5h14"/>
      <path d="M5 9h10"/>
      <path d="M5 13h14"/>
      <path d="M5 17h10"/>
      <path d="M5 21h14"/>
    </svg>
  ),
  [WEATHER_TYPES.HAZE]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M5.2 6.2h14"/>
      <path d="M4 10h16"/>
      <path d="M5.2 14h14"/>
      <path d="M4 18h16"/>
    </svg>
  ),
  [WEATHER_TYPES.WINDY]: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
    </svg>
  ),
};

// Helper function to get weather icon by type
export const getWeatherIcon = (weatherType: string | null | undefined) => {
  if (!weatherType) return null;
  return WeatherIcons[weatherType as WeatherType] || null;
};
