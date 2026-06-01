"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_ICON } from "./icons";

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  value: LatLng | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}

// US fallback center when no point chosen yet.
const FALLBACK_CENTER: [number, number] = [27.5, -81.5];

function ClickHandler({ onChange }: { onChange: Props["onChange"] }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Recenter when value is set/changed externally (e.g. edit form load).
function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 9));
  }, [value, map]);
  return null;
}

export default function LocationPickerMap({ value, onChange, height = 320 }: Props) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : FALLBACK_CENTER}
      zoom={value ? 9 : 5}
      style={{ height, width: "100%" }}
      className="rounded-md z-0"
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <ClickHandler onChange={onChange} />
      <Recenter value={value} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={BASE_ICON()}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = e.target.getLatLng();
              onChange(p.lat, p.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
