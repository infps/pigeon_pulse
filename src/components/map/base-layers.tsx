"use client";

import { LayersControl, TileLayer } from "react-leaflet";

const { BaseLayer } = LayersControl;

// OpenTopoMap caps at 17 — keep all base layers the same so switching
// (e.g. Satellite → Terrain) never clamps zoom and desyncs marker panes.
export const MAP_MAX_ZOOM = 17;

// Topography switcher — all free tile sources, no API key.
export function BaseLayers() {
  return (
    <LayersControl position="topright">
      <BaseLayer checked name="Street">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={MAP_MAX_ZOOM}
        />
      </BaseLayer>
      <BaseLayer name="Terrain">
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
          maxZoom={MAP_MAX_ZOOM}
        />
      </BaseLayer>
      <BaseLayer name="Satellite">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          maxZoom={MAP_MAX_ZOOM}
        />
      </BaseLayer>
    </LayersControl>
  );
}
