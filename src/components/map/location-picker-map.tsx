"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, useMapEvents, useMap, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_ICON } from "./icons";
import { BaseLayers, MAP_MAX_ZOOM } from "./base-layers";
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
  const map = useMap();
  useMapEvents({
    click(e) {
      // Search result list is portaled to body; picking closes it and the same
      // click lands on the map — MapSearchControl sets this flag to ignore it.
      if ((map as typeof map & { _ppSuppressClick?: boolean })._ppSuppressClick) return;
      // Layer/search/zoom controls live inside the map — ignore those clicks
      // so switching Satellite → Terrain never relocates the pin.
      const t = e.originalEvent?.target as Element | null;
      if (t?.closest?.(".leaflet-control")) return;
      onChange(e.latlng.lat, e.latlng.lng);
      onAddress?.(null); // raw click has no address label
    },
  });
  return null;
}

// Recenter only when lat/lng numbers change (not on new object identity each render).
function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  const lat = value?.lat;
  const lng = value?.lng;
  const prev = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (lat == null || lng == null) return;
    const same = prev.current && prev.current.lat === lat && prev.current.lng === lng;
    prev.current = { lat, lng };
    if (same) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 9));
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ value, onChange, onAddress, height = 320 }: Props) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : FALLBACK_CENTER}
      zoom={value ? 9 : 5}
      maxZoom={MAP_MAX_ZOOM}
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
