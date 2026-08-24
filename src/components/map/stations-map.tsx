"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_ICON, ACTIVE_ICON, INACTIVE_ICON, pinIcon } from "./icons";
import { BaseLayers, MAP_MAX_ZOOM } from "./base-layers";
import { MapSearchControl } from "./map-search";

export interface MapStation {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  miles: number | null;
  isActive: boolean;
  color?: string | null;
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
  // Controlled focus: when provided, parent owns the focused station.
  selectedId?: number | null;
  onSelectId?: (id: number | null) => void;
  // When provided, Edit/Delete buttons appear next to Clear for the focused station.
  onEditSelected?: (id: number) => void;
  onDeleteSelected?: (id: number) => void;
}

const FALLBACK_CENTER: [number, number] = [27.5, -81.5];

function FitBounds({ base, points }: { base: Base | null; points: MapStation[] }) {
  const map = useMap();
  // Stable key so fitBounds only re-runs when coordinates actually change, not on every re-render
  const coordKey = [
    base ? `${base.lat},${base.lng}` : "",
    ...points.map((s) => `${s.id}:${s.latitude},${s.longitude}`),
  ].join("|");
  const prevKey = useRef<string>("");
  useEffect(() => {
    if (coordKey === prevKey.current) return;
    prevKey.current = coordKey;
    const coords: [number, number][] = [];
    if (base) coords.push([base.lat, base.lng]);
    points.forEach((s) => coords.push([s.latitude as number, s.longitude as number]));
    if (coords.length === 1) {
      map.setView(coords[0], 9);
    } else if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  });
  return null;
}

// Action bar shown next to the search box while a station is focused:
// Clear always; Edit/Delete when the parent provides handlers.
function FocusActions({
  onClear,
  onEdit,
  onDelete,
}: {
  onClear: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  return (
    <div ref={ref} className="absolute top-2 left-68 z-1000 flex gap-1.5">
      <button
        type="button"
        onClick={onClear}
        className="px-3 py-1.5 text-sm rounded border bg-white text-black shadow hover:bg-gray-100"
      >
        Clear
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-1.5 text-sm rounded border bg-white text-black shadow hover:bg-gray-100"
        >
          Edit
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="px-3 py-1.5 text-sm rounded border bg-white text-red-600 shadow hover:bg-red-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}

export default function StationsMap({
  base,
  stations,
  height = 460,
  onSelect,
  selectedId,
  onSelectId,
  onEditSelected,
  onDeleteSelected,
}: Props) {
  const points = stations.filter((s) => s.latitude != null && s.longitude != null);
  const [internalId, setInternalId] = useState<number | null>(null);
  // Controlled when parent passes selectedId/onSelectId, else internal.
  const focusedId = selectedId !== undefined ? selectedId : internalId;
  const setFocusedId = (id: number | null) => {
    if (onSelectId) onSelectId(id);
    else setInternalId(id);
  };

  // While focused (and that station is in view), show only it (+ loft base).
  const focusPresent = focusedId != null && points.some((s) => s.id === focusedId);
  const shown = focusPresent ? points.filter((s) => s.id === focusedId) : points;
  const isFocused = focusPresent;

  return (
    <MapContainer
      center={base ? [base.lat, base.lng] : FALLBACK_CENTER}
      zoom={6}
      maxZoom={MAP_MAX_ZOOM}
      style={{ height, width: "100%" }}
      className="rounded-md z-0"
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <BaseLayers />
      <MapSearchControl />
      {isFocused && (
        <FocusActions
          onClear={() => setFocusedId(null)}
          onEdit={onEditSelected ? () => onEditSelected(focusedId as number) : undefined}
          onDelete={onDeleteSelected ? () => onDeleteSelected(focusedId as number) : undefined}
        />
      )}
      <FitBounds base={base} points={shown} />

      {base && (
        <Marker position={[base.lat, base.lng]} icon={BASE_ICON()}>
          <Popup>{base.name || "Event location"}</Popup>
        </Marker>
      )}

      {shown.map((s) => {
        const pos: [number, number] = [s.latitude as number, s.longitude as number];
        const focused = s.id === focusedId;
        return (
          <Fragment key={s.id}>
            {base && (
              <Polyline
                positions={[[base.lat, base.lng], pos]}
                pathOptions={
                  focused
                    ? { color: "#2563eb", weight: 3 }
                    : { color: "#94a3b8", weight: 1.5, dashArray: "5 6" }
                }
              />
            )}
            <Marker
              position={pos}
              icon={
                !s.isActive
                  ? INACTIVE_ICON()
                  : s.color
                    ? pinIcon(s.color)
                    : ACTIVE_ICON()
              }
              eventHandlers={{
                click: () => {
                  setFocusedId(s.id);
                  onSelect?.(s.id);
                },
              }}
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
