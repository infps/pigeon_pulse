"use client";

import { useEffect, useRef } from "react";
import type { RouteConfig, RouteSample } from "@/lib/map/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function kindColor(kind: string) {
  return kind === "tailwind" ? "#16a34a" : kind === "headwind" ? "#dc2626" : "#d97706";
}

function popupHtml(s: RouteSample): string {
  const w = s.wind;
  const tail = w.tailMs >= 0 ? "+" : "";
  return `
    <div style="font:13px/1.5 sans-serif;min-width:180px">
      <div style="font-weight:600;margin-bottom:4px">Mile ${s.distMiles.toFixed(1)}</div>
      <div>Temp: <b>${(s.tempK - 273.15).toFixed(1)}°C</b> / ${((s.tempK - 273.15) * 1.8 + 32).toFixed(1)}°F</div>
      <div>Wind: <b>${w.speedMph.toFixed(1)} mph</b> from ${w.dirFrom.toFixed(0)}°</div>
      <div>Along-track: ${tail}${w.tailMs.toFixed(1)} m/s · cross: ${w.crossMs.toFixed(1)} m/s ${w.crossSide}</div>
      <div style="margin-top:4px">
        <span style="background:${kindColor(w.kind)};color:#fff;padding:2px 7px;border-radius:4px;font-weight:600;font-size:11px;text-transform:uppercase">${w.kind}</span>
      </div>
    </div>`;
}

export default function WindyRaceMap({ config }: { config: RouteConfig | null }) {
  const layerRef = useRef<any>(null);

  // Boot Windy embed once per page lifetime (stored on window)
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_WINDY_MAP_KEY;
    if (!key) { console.error("NEXT_PUBLIC_WINDY_MAP_KEY not set"); return; }
    const win = window as any;

    (async () => {
      await loadScript("https://unpkg.com/leaflet@1.4.0/dist/leaflet.js");
      await loadScript("https://api.windy.com/assets/map-forecast/libBoot.js");

      if (!win.__windyApi) {
        win.windyInit?.(
          { key, lat: 27, lon: -81, zoom: 5 },
          (api: any) => {
            win.__windyApi = api;
            drawRoute(api, config);
          }
        );
      } else {
        drawRoute(win.__windyApi, config);
      }
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when config arrives
  useEffect(() => {
    const win = window as any;
    if (win.__windyApi && config) drawRoute(win.__windyApi, config);
  }, [config]);

  return <div id="windy" style={{ width: "100%", height: "100%" }} />;
}

function drawRoute(api: any, config: RouteConfig | null) {
  if (!config) return;
  const L = (window as any).L;
  const win = window as any;
  if (win.__windyRouteLayer) {
    try { api.map.removeLayer(win.__windyRouteLayer); } catch (_) {}
  }

  const group = L.layerGroup();

  // Route polyline
  L.polyline(
    config.samples.map((s) => [s.lat, s.lon]),
    { color: "#2563eb", weight: 3, opacity: 0.9 }
  ).addTo(group);

  // Release + destination markers
  L.marker([config.release.lat, config.release.lon])
    .bindTooltip(config.release.label || "Release", { permanent: false })
    .addTo(group);
  L.marker([config.dest.lat, config.dest.lon])
    .bindTooltip(config.dest.label || "Destination", { permanent: false })
    .addTo(group);

  // Clickable dots every ~N samples
  const step = Math.max(1, Math.floor(config.samples.length / 60));
  config.samples.forEach((s, i) => {
    if (i % step !== 0) return;
    L.circleMarker([s.lat, s.lon], {
      radius: 4,
      color: "#1e3a8a",
      fillColor: kindColor(s.wind.kind),
      fillOpacity: 0.85,
    })
      .on("click", () => {
        L.popup()
          .setLatLng([s.lat, s.lon])
          .setContent(popupHtml(s))
          .openOn(api.map);
      })
      .addTo(group);
  });

  group.addTo(api.map);
  win.__windyRouteLayer = group;
  api.map.fitBounds(
    L.latLngBounds(config.samples.map((s) => [s.lat, s.lon])),
    { padding: [40, 40] }
  );
}
