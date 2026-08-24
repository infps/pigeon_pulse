"use client";

import { MapContainer, Marker, Popup, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_ICON } from "./icons";
import { BaseLayers, MAP_MAX_ZOOM } from "./base-layers";

interface Props {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
}

export default function StaticPinMap({ lat, lng, label, height = 280 }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={11}
      maxZoom={MAP_MAX_ZOOM}
      style={{ height, width: "100%" }}
      className="rounded-md z-0"
      scrollWheelZoom={false}
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <BaseLayers />
      <Marker position={[lat, lng]} icon={BASE_ICON()}>
        {label && <Popup>{label}</Popup>}
      </Marker>
    </MapContainer>
  );
}
