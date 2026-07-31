import type { WindResolved } from "./wind";

export type RouteSample = {
  lat: number;
  lon: number;
  distMiles: number;
  cell: string;
  tempK: number;
  windU: number;
  windV: number;
  wind: WindResolved;
};

/** Windy Map Forecast overlay ids (store.set('overlay', …)). */
export type WindyOverlay =
  | "wind"
  | "gust"
  | "rain"
  | "temp"
  | "clouds"
  | "pressure";

export type RouteMeta = {
  eventName: string;
  seasonName: string;
  raceName: string;
  raceTypeName: string;
  /** Race start ms for Windy timeline, if known */
  startTimeMs: number | null;
};

export type RouteConfig = {
  flightBearing: number;
  release: { lat: number; lon: number; label: string };
  dest: { lat: number; lon: number; label: string };
  samples: RouteSample[];
  meta?: RouteMeta;
};

/** Title: [Event] [Season] - [Race] / [Type] */
export function formatRouteTitle(meta?: RouteMeta | null): string {
  if (!meta) return "Route · Weather";
  const left = [meta.eventName, meta.seasonName].filter(Boolean).join(" ");
  const right = [meta.raceName, meta.raceTypeName].filter(Boolean).join(" / ");
  if (left && right) return `${left} - ${right}`;
  return left || right || "Route · Weather";
}
