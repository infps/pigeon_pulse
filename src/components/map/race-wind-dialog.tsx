"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Globe, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RouteConfig } from "@/lib/map/types";

const WindyRaceMap = dynamic(() => import("./windy-race-map"), { ssr: false });

interface Props {
  raceId: number | string;
}

export function RaceWindButton({ raceId }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<RouteConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={handleOpen}
        title="View route map with wind & weather"
      >
        <Globe className="h-4 w-4" />
        Map
      </Button>

      {/* Keep mounted once opened so Windy embed stays alive */}
      {mounted && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-150 ${
            open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{ width: "50vw", height: "50vh", minWidth: 480, minHeight: 360 }}>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-white/90 backdrop-blur-sm border-b">
              <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-blue-600" />
                Route · Wind &amp; Weather
              </span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Map area */}
            <div className="absolute inset-0 pt-10">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  Loading wind data…
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-red-600 bg-red-50 z-10 p-4 text-center">
                  <Globe className="h-6 w-6" />
                  {error}
                </div>
              )}
              {!loading && !error && <WindyRaceMap config={config} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
