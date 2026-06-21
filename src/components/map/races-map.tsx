"use client";

import { Fragment, useEffect } from "react";
import Link from "next/link";
import { MapContainer, Marker, Polyline, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pinIcon } from "./icons";
import { BaseLayers } from "./base-layers";
import { MapSearchControl } from "./map-search";

export interface MapRace {
  id: number;
  name: string | null;
  description: string | null;
  distance: number | null;
  startTime: string | null;
  status: string | null;
  station: { name: string | null; lat: number; lng: number };
  loft: { eventId: number; name: string | null; lat: number; lng: number };
}

interface Props {
  races: MapRace[];
  height?: number;
}

const FALLBACK_CENTER: [number, number] = [27.5, -81.5];

const STATION_ICON = pinIcon("#2563eb"); // blue = release point
const LOFT_ICON = pinIcon("#dc2626"); // red = loft/event

function FitBounds({ races }: { races: MapRace[] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    races.forEach((r) => {
      coords.push([r.station.lat, r.station.lng]);
      coords.push([r.loft.lat, r.loft.lng]);
    });
    if (coords.length === 1) map.setView(coords[0], 9);
    else if (coords.length > 1)
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
  }, [races, map]);
  return null;
}

export default function RacesMap({ races, height = 520 }: Props) {
  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={6}
      style={{ height, width: "100%" }}
      className="rounded-md z-0"
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <BaseLayers />
      <MapSearchControl />
      <FitBounds races={races} />

      {races.map((r) => {
        const live = r.status === "STARTED";
        const stationPos: [number, number] = [r.station.lat, r.station.lng];
        const loftPos: [number, number] = [r.loft.lat, r.loft.lng];
        return (
          <Fragment key={r.id}>
            <Polyline
              positions={[stationPos, loftPos]}
              pathOptions={
                live
                  ? { color: "#dc2626", weight: 3 }
                  : { color: "#94a3b8", weight: 2, dashArray: "5 6", opacity: 0.7 }
              }
            />
            <Marker position={stationPos} icon={STATION_ICON} opacity={live ? 1 : 0.6}>
              <Popup>
                <RacePopup r={r} point="station" />
              </Popup>
            </Marker>
            <Marker position={loftPos} icon={LOFT_ICON} opacity={live ? 1 : 0.6}>
              <Popup>
                <RacePopup r={r} point="loft" />
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}

function RacePopup({ r, point }: { r: MapRace; point: "station" | "loft" }) {
  const live = r.status === "STARTED";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="font-semibold">{r.description || r.name || "Race"}</span>
        {live ? (
          <span className="text-[10px] font-bold text-red-600">LIVE</span>
        ) : (
          <span className="text-[10px] font-medium text-gray-500">UPCOMING</span>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {point === "station" ? "Release: " : "Loft: "}
        <span className="font-medium">
          {point === "station" ? r.station.name || "-" : r.loft.name || "-"}
        </span>
      </div>
      {r.distance != null && (
        <div className="text-xs text-gray-600">{r.distance} mi</div>
      )}
      <Link href={`/races/${r.id}`} className="text-xs text-blue-600 hover:underline">
        View race →
      </Link>
    </div>
  );
}
