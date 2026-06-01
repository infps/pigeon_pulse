// Geo distance helpers. Single source of truth for client preview + server authority.

const EARTH_RADIUS_KM = 6371;
const KM_PER_MILE = 1.609344;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points.
 * Returns both km and miles, rounded to 2 decimals.
 */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): { km: number; miles: number } {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = EARTH_RADIUS_KM * c;
  return {
    km: Math.round(km * 100) / 100,
    miles: Math.round((km / KM_PER_MILE) * 100) / 100,
  };
}
