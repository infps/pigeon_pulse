"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

interface Result {
  lat: number;
  lon: number;
  label: string;
}

// Free OSM geocoder. No key. Low volume only (Nominatim usage policy).
async function geocode(q: string): Promise<Result[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return data.map((d) => ({ lat: Number(d.lat), lon: Number(d.lon), label: d.display_name }));
}

interface Props {
  onPick?: (lat: number, lng: number) => void;
  onAddress?: (label: string) => void;
}

// Address search box overlaid on the map. onPick fires for picker maps (drops pin);
// always recenters the map. Click/scroll propagation to the map is disabled so
// interacting with the box never triggers map clicks (e.g. pin placement).
export function MapSearchControl({ onPick, onAddress }: Props) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [boxRect, setBoxRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    L.DomEvent.disableScrollPropagation(el);
    L.DomEvent.disableClickPropagation(el);
  }, []);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setBoxRect(ref.current?.getBoundingClientRect() ?? null);
    try {
      setResults(await geocode(q));
    } finally {
      setLoading(false);
    }
  };

  const pick = (r: Result) => {
    map.setView([r.lat, r.lon], 13);
    onPick?.(r.lat, r.lon);
    onAddress?.(r.label);
    setResults([]);
    setQ(r.label);
  };

  const dropdown = results.length > 0 && boxRect
    ? createPortal(
        <ul
          className="fixed bg-white rounded shadow max-h-48 overflow-auto text-sm z-[9999]"
          style={{ top: boxRect.bottom + 4, left: boxRect.left, width: boxRect.width }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => { pick(r); setResults([]); }}
                className="block w-full text-left px-2 py-1.5 hover:bg-gray-100 text-black"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )
    : null;

  return (
    <>
      <div ref={ref} className="absolute top-2 left-2 z-[1000] w-64">
        <div className="flex shadow">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
            placeholder="Search address..."
            className="flex-1 px-2 py-1.5 text-sm rounded-l border bg-white text-black outline-none"
          />
          <button
            type="button"
            onMouseDown={run}
            className="px-2 bg-white border border-l-0 rounded-r hover:bg-gray-100"
            aria-label="Search"
          >
            <Search className="h-4 w-4 text-gray-700" />
          </button>
        </div>
        {loading && (
          <div className="bg-white text-xs px-2 py-1 mt-1 rounded shadow text-gray-600">Searching…</div>
        )}
      </div>
      {dropdown}
    </>
  );
}
