"use client";

import { useEffect, useRef } from "react";
import type { RouteConfig, RouteSample, WindyOverlay } from "@/lib/map/types";

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

type Props = {
  config: RouteConfig | null;
  /** Active Windy weather overlay */
  overlay?: WindyOverlay;
};

/**
 * Original route drawing (restored): default Leaflet panes, L.marker + circleMarkers,
 * fitBounds padding [40,40]. No custom z-index panes that hid points under weather.
 */
export default function WindyRaceMap({ config, overlay = "wind" }: Props) {
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const configRef = useRef(config);
  configRef.current = config;

  // Boot Windy once; always paint latest config from ref
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_WINDY_MAP_KEY;
    if (!key) {
      console.error("NEXT_PUBLIC_WINDY_MAP_KEY not set");
      return;
    }
    const win = window as any;

    (async () => {
      await loadScript("https://unpkg.com/leaflet@1.4.0/dist/leaflet.js");
      await loadScript("https://api.windy.com/assets/map-forecast/libBoot.js");

      const paint = (api: any) => {
        applyOverlay(api, overlayRef.current, configRef.current?.meta?.startTimeMs ?? null);
        drawRoute(api, configRef.current);
      };

      // Drop stale instance (HMR / remount left map on a detached #windy)
      if (win.__windyApi) {
        const container = win.__windyApi.map?.getContainer?.() as HTMLElement | undefined;
        if (!container || !document.body.contains(container)) {
          win.__windyApi = null;
          win.__windyRouteLayer = null;
        }
      }

      if (!win.__windyApi) {
        const cfg = configRef.current;
        const lat = cfg?.release.lat ?? 27;
        const lon = cfg?.release.lon ?? -81;
        win.windyInit?.(
          {
            key,
            lat,
            lon,
            zoom: 7,
            overlay: overlayRef.current,
            hourFormat: "12h",
          },
          (api: any) => {
            win.__windyApi = api;
            paint(api);
          }
        );
      } else {
        paint(win.__windyApi);
      }
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when route data arrives / changes
  useEffect(() => {
    const win = window as any;
    if (win.__windyApi && config) {
      applyOverlay(win.__windyApi, overlayRef.current, config.meta?.startTimeMs ?? null);
      drawRoute(win.__windyApi, config);
    }
  }, [config]);

  // Switch Windy layer only (Wind / Gusts / Rain / Temp / Clouds / Pressure)
  useEffect(() => {
    const win = window as any;
    if (!win.__windyApi?.store) return;
    applyOverlay(win.__windyApi, overlay, configRef.current?.meta?.startTimeMs ?? null);
  }, [overlay]);

  return <div id="windy" style={{ width: "100%", height: "100%" }} />;
}

function applyOverlay(api: any, overlay: WindyOverlay, startTimeMs: number | null) {
  try {
    const store = api.store;
    if (!store) return;
    store.set("overlay", overlay);
    if (overlay === "wind" || overlay === "gust") {
      store.set("particlesAnim", "on");
    } else {
      store.set("particlesAnim", "off");
    }
    if (startTimeMs && Number.isFinite(startTimeMs)) {
      store.set("timestamp", startTimeMs);
    }
  } catch (e) {
    console.warn("Windy overlay switch failed", e);
  }
}

/** Original drawRoute — identical behavior to first implementation */
function drawRoute(api: any, config: RouteConfig | null) {
  if (!config?.samples?.length) return;
  const L = (window as any).L;
  const win = window as any;
  if (win.__windyRouteLayer) {
    try {
      api.map.removeLayer(win.__windyRouteLayer);
    } catch (_) {
      /* ignore */
    }
  }

  const group = L.layerGroup();

  // Route polyline
  L.polyline(
    config.samples.map((s) => [s.lat, s.lon]),
    { color: "#2563eb", weight: 3, opacity: 0.9 }
  ).addTo(group);

  // Release + destination markers (default Leaflet markers)
  L.marker([config.release.lat, config.release.lon])
    .bindTooltip(config.release.label || "Release", { permanent: false })
    .addTo(group);
  L.marker([config.dest.lat, config.dest.lon])
    .bindTooltip(config.dest.label || "Destination", { permanent: false })
    .addTo(group);

  // Clickable dots every ~N samples (wind-kind fill)
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
