"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Leaflet needs `window` → load client-only.
export const LocationPickerMap = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => <Skeleton className="w-full" style={{ height: 320 }} />,
});

export const StationsMap = dynamic(() => import("./stations-map"), {
  ssr: false,
  loading: () => <Skeleton className="w-full" style={{ height: 460 }} />,
});

export const TruckTrackMap = dynamic(() => import("./truck-track-map"), {
  ssr: false,
  loading: () => <Skeleton className="w-full" style={{ height: 360 }} />,
});

export type { LatLng } from "./location-picker-map";
export type { MapStation } from "./stations-map";
export type { TrackPoint, TruckPoint } from "./truck-track-map";
