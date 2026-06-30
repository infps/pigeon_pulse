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

export type RouteConfig = {
  flightBearing: number;
  release: { lat: number; lon: number; label: string };
  dest: { lat: number; lon: number; label: string };
  samples: RouteSample[];
};
