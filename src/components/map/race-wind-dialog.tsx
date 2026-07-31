"use client";

import { useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import {
  Cloud,
  CloudRain,
  Gauge,
  Loader2,
  Thermometer,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatRouteTitle,
  type RouteConfig,
  type WindyOverlay,
} from "@/lib/map/types";

const WindyRaceMap = dynamic(() => import("./windy-race-map"), { ssr: false });

interface Props {
  raceId: number | string;
}

const LAYERS: {
  id: WindyOverlay;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "wind", label: "Wind", icon: Wind },
  { id: "gust", label: "Gusts", icon: Zap },
  { id: "rain", label: "Rain", icon: CloudRain },
  { id: "temp", label: "Temp", icon: Thermometer },
  { id: "clouds", label: "Clouds", icon: Cloud },
  { id: "pressure", label: "Pressure", icon: Gauge },
];

export function RaceWindButton({ raceId }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<RouteConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<WindyOverlay>("wind");

  const handleOpen = async () => {
    setOpen(true);
    if (!mounted) {
      setMounted(true);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/race/${raceId}/wind-route`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { message?: string }).message || `Error ${res.status}`);
        }
        setConfig(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load wind data");
      } finally {
        setLoading(false);
      }
    }
  };

  const title = formatRouteTitle(config?.meta);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={handleOpen}
        title="View route map with wind & weather"
      >
        <Wind className="h-4 w-4" />
        Map
      </Button>

      {/* Keep mounted once opened so Windy embed stays alive */}
      {mounted && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-150",
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="relative flex flex-col bg-background text-foreground border border-border rounded-xl shadow-2xl overflow-hidden"
            style={{
              width: "min(96vw, 1200px)",
              height: "min(90vh, 800px)",
              minWidth: 320,
              minHeight: 360,
            }}
          >
            {/* Header: [Event] [Season] - [Race] / [Type] */}
            <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b border-border bg-background">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-foreground leading-snug truncate">
                  <span className="text-violet-600 dark:text-violet-400 mr-1.5" aria-hidden>
                    ◆
                  </span>
                  {loading && !config ? "Loading weather map…" : title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Layer chips */}
            <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/50">
              {LAYERS.map(({ id, label, icon: Icon }) => {
                const active = overlay === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOverlay(id)}
                    disabled={loading || !!error}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-foreground border-border hover:bg-muted",
                      (loading || error) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Map — mount only when ready (original pattern; avoids empty/broken Windy init) */}
            <div className="relative flex-1 min-h-0">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground bg-background z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  Loading wind data…
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-destructive bg-background z-10 p-4 text-center">
                  <Wind className="h-6 w-6" />
                  {error}
                </div>
              )}
              {!loading && !error && <WindyRaceMap config={config} overlay={overlay} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
