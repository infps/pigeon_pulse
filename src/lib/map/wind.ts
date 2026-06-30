// Wind vector math relative to flight direction.
const toDeg = (r: number) => (r * 180) / Math.PI;

export type WindResolved = {
  speedMs: number;
  speedMph: number;
  dirFrom: number;
  dirTo: number;
  tailMs: number;
  crossMs: number;
  crossSide: "left" | "right";
  kind: "tailwind" | "headwind" | "crosswind";
};

export function resolveWind(u: number, v: number, flightBearing: number): WindResolved {
  const speedMs = Math.hypot(u, v);
  const dirTo = (toDeg(Math.atan2(u, v)) + 360) % 360;
  const dirFrom = (dirTo + 180) % 360;
  const rel = ((dirTo - flightBearing + 540) % 360) - 180;
  const relRad = (rel * Math.PI) / 180;
  const tailMs = speedMs * Math.cos(relRad);
  const crossSigned = speedMs * Math.sin(relRad);
  let kind: WindResolved["kind"];
  if (Math.abs(tailMs) >= Math.abs(crossSigned)) {
    kind = tailMs >= 0 ? "tailwind" : "headwind";
  } else {
    kind = "crosswind";
  }
  return {
    speedMs,
    speedMph: speedMs * 2.236936,
    dirFrom,
    dirTo,
    tailMs,
    crossMs: Math.abs(crossSigned),
    crossSide: crossSigned >= 0 ? "right" : "left",
    kind,
  };
}
