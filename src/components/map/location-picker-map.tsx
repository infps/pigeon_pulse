"use client";

import { useEffect } from "react";
import { MapContainer, Marker, useMapEvents, useMap, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_ICON } from "./icons";
import { BaseLayers } from "./base-layers";
import { MapSearchControl } from "./map-search";

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  value: LatLng | null;
  onChange: (lat: number, lng: number) => void;
  onAddress?: (label: string | null) => void;
  height?: number;
}

// US fallback center when no point chosen yet.
const FALLBACK_CENTER: [number, number] = [27.5, -81.5];

function ClickHandler({ onChange, onAddress }: { onChange: Props["onChange"]; onAddress?: Props["onAddress"] }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
      onAddress?.(null); // raw click has no address label
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

export default function LocationPickerMap({ value, onChange, onAddress, height = 320 }: Props) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : FALLBACK_CENTER}
      zoom={value ? 9 : 5}
      style={{ height, width: "100%" }}
      className="rounded-md z-0"
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <BaseLayers />
      <MapSearchControl onPick={(lat, lng) => onChange(lat, lng)} onAddress={onAddress} />
      <ClickHandler onChange={onChange} onAddress={onAddress} />
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
              onAddress?.(null);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
