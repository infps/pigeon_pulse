"use client";

import { Fragment, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_ICON, ACTIVE_ICON, INACTIVE_ICON } from "./icons";

export interface MapStation {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  miles: number | null;
  isActive: boolean;
}

interface Base {
  lat: number;
  lng: number;
  name?: string;
}

interface Props {
  base: Base | null;
  stations: MapStation[];
  height?: number;
  onSelect?: (id: number) => void;
}

const FALLBACK_CENTER: [number, number] = [27.5, -81.5];

function FitBounds({ base, points }: { base: Base | null; points: MapStation[] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    if (base) coords.push([base.lat, base.lng]);
    points.forEach((s) => coords.push([s.latitude as number, s.longitude as number]));
    if (coords.length === 1) {
      map.setView(coords[0], 9);
    } else if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [base, points, map]);
  return null;
}

export default function StationsMap({ base, stations, height = 460, onSelect }: Props) {
  const points = stations.filter((s) => s.latitude != null && s.longitude != null);

  return (
    <MapContainer
      center={base ? [base.lat, base.lng] : FALLBACK_CENTER}
      zoom={6}
      style={{ height, width: "100%" }}
      className="rounded-md z-0"
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitBounds base={base} points={points} />

      {base && (
        <Marker position={[base.lat, base.lng]} icon={BASE_ICON()}>
          <Popup>{base.name || "Event location"}</Popup>
        </Marker>
      )}

      {points.map((s) => {
        const pos: [number, number] = [s.latitude as number, s.longitude as number];
        return (
          <Fragment key={s.id}>
            {base && (
              <Polyline
                positions={[[base.lat, base.lng], pos]}
                pathOptions={{ color: "#94a3b8", weight: 1.5, dashArray: "5 6" }}
              />
            )}
            <Marker
              position={pos}
              icon={s.isActive ? ACTIVE_ICON() : INACTIVE_ICON()}
              eventHandlers={onSelect ? { click: () => onSelect(s.id) } : undefined}
            >
              <Popup>
                <span className="font-medium">{s.name}</span>
                {s.miles != null && <> — {s.miles} mi</>}
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
