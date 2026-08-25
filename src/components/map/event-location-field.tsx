"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPickerMap } from "@/components/map";

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

export function EventLocationField({ latitude, longitude, onChange }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [latInput, setLatInput] = useState(latitude != null ? String(latitude) : "");
  const [lngInput, setLngInput] = useState(longitude != null ? String(longitude) : "");

  const value = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null;

  // Sync inputs when map click/drag/search changes the value
  useEffect(() => {
    setLatInput(latitude != null ? String(latitude) : "");
    setLngInput(longitude != null ? String(longitude) : "");
  }, [latitude, longitude]);

  const applyCoords = (lat: string, lng: string) => {
    const la = parseFloat(lat);
    const lo = parseFloat(lng);
    if (!isNaN(la) && !isNaN(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180) {
      onChange(la, lo);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Event Location</Label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { onChange(null, null); setAddress(null); setLatInput(""); setLngInput(""); }}
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Click the map, drag the pin, search by name, or paste coordinates below.
      </p>
      <LocationPickerMap value={value} onChange={(lat, lng) => onChange(lat, lng)} onAddress={setAddress} />
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Latitude</Label>
          <Input
            placeholder="-90 to 90"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={() => applyCoords(latInput, lngInput)}
            onKeyDown={(e) => e.key === "Enter" && applyCoords(latInput, lngInput)}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Longitude</Label>
          <Input
            placeholder="-180 to 180"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={() => applyCoords(latInput, lngInput)}
            onKeyDown={(e) => e.key === "Enter" && applyCoords(latInput, lngInput)}
          />
        </div>
      </div>
      {address && <p className="text-xs text-muted-foreground">{address}</p>}
    </div>
  );
}
