"use client";

import { LayersControl, TileLayer } from "react-leaflet";

const { BaseLayer } = LayersControl;

// Topography switcher — all free tile sources, no API key.
export function BaseLayers() {
  return (
    <LayersControl position="topright">
      <BaseLayer checked name="Street">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
      </BaseLayer>
      <BaseLayer name="Terrain">
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
          maxZoom={17}
        />
      </BaseLayer>
      <BaseLayer name="Satellite">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
        />
      </BaseLayer>
    </LayersControl>
  );
}
