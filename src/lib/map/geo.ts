// Great-circle geo math. All distances in miles.
export type LatLon = { lat: number; lon: number };

const R_MILES = 3958.7613;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function distanceMiles(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a: LatLon, b: LatLon): number {
  const la1 = toRad(a.lat), la2 = toRad(b.lat), dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function intermediate(a: LatLon, b: LatLon, f: number): LatLon {
  const la1 = toRad(a.lat), lo1 = toRad(a.lon), la2 = toRad(b.lat), lo2 = toRad(b.lon);
  const d = distanceMiles(a, b) / R_MILES;
  if (d === 0) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
  const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
  const z = A * Math.sin(la1) + B * Math.sin(la2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lon: toDeg(Math.atan2(y, x)) };
}

export type SamplePoint = LatLon & { distMiles: number };

export function samplePoints(a: LatLon, b: LatLon, intervalMiles: number): SamplePoint[] {
  const total = distanceMiles(a, b);
  const steps = Math.max(1, Math.floor(total / intervalMiles));
  const out: SamplePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    out.push({ ...intermediate(a, b, f), distMiles: f * total });
  }
  return out;
}
