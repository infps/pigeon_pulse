"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pinIcon } from "./icons";
import { BaseLayers, MAP_MAX_ZOOM } from "./base-layers";

export interface TrackPoint {
  lat: number;
  lng: number;
}

export interface TruckPoint {
  lat: number;
  lng: number;
  heading?: number | null;
}

interface NamedPoint {
  lat: number;
  lng: number;
  name?: string | null;
}

interface Props {
  loft: NamedPoint | null;
  station: NamedPoint | null;
  pings: TrackPoint[];
  truck: TruckPoint | null;
  height?: number;
}

const FALLBACK_CENTER: [number, number] = [27.5, -81.5];

// Loft = green pin (start), station = red pin (release point).
const LOFT_ICON = () => pinIcon("#16a34a");
const STATION_ICON = () => pinIcon("#dc2626");

// Truck divIcon — emoji, rotated by heading (0 = north). Anchored to center.
function truckIcon(heading?: number | null): L.DivIcon {
  const rot = typeof heading === "number" && !isNaN(heading) ? heading : 0;
  return L.divIcon({
    className: "",
    html: `<div style="
        width:34px;height:34px;display:flex;align-items:center;justify-content:center;
        font-size:24px;line-height:1;
        filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));
        transform:rotate(${rot}deg);transform-origin:center;
      ">🚚</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

function FitBounds({
  loft,
  station,
  pings,
  truck,
}: {
  loft: NamedPoint | null;
  station: NamedPoint | null;
  pings: TrackPoint[];
  truck: TruckPoint | null;
}) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    if (loft) coords.push([loft.lat, loft.lng]);
    if (station) coords.push([station.lat, station.lng]);
    if (truck) coords.push([truck.lat, truck.lng]);
    pings.forEach((p) => coords.push([p.lat, p.lng]));
    if (coords.length === 1) {
      map.setView(coords[0], 10);
    } else if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
    // Re-fit when the set of anchor points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loft?.lat,
    loft?.lng,
    station?.lat,
    station?.lng,
    truck?.lat,
    truck?.lng,
    pings.length,
    map,
  ]);
  return null;
}

export default function TruckTrackMap({
  loft,
  station,
  pings,
  truck,
  height = 360,
}: Props) {
  const line: [number, number][] = pings.map((p) => [p.lat, p.lng]);
  const center: [number, number] = truck
    ? [truck.lat, truck.lng]
    : loft
      ? [loft.lat, loft.lng]
      : station
        ? [station.lat, station.lng]
        : FALLBACK_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={8}
      maxZoom={MAP_MAX_ZOOM}
      style={{ height, width: "100%" }}
      className="rounded-md z-0"
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <BaseLayers />
      <FitBounds loft={loft} station={station} pings={pings} truck={truck} />

      {loft && (
        <Marker position={[loft.lat, loft.lng]} icon={LOFT_ICON()}>
          <Popup>{loft.name || "Loft"}</Popup>
        </Marker>
      )}

      {station && (
        <Marker position={[station.lat, station.lng]} icon={STATION_ICON()}>
          <Popup>{station.name || "Release station"}</Popup>
        </Marker>
      )}

      {line.length > 1 && (
        <Polyline positions={line} pathOptions={{ color: "#2563eb", weight: 3 }} />
      )}

      {truck && (
        <Marker position={[truck.lat, truck.lng]} icon={truckIcon(truck.heading)}>
          <Popup>Truck</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
