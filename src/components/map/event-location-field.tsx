"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationPickerMap } from "@/components/map";
import { toast } from "sonner";

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

export function EventLocationField({ latitude, longitude, onChange }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [coordInput, setCoordInput] = useState("");

  const value = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null;

  // Sync display text when map click/drag/search changes coords
  useEffect(() => {
    if (latitude != null && longitude != null) {
      setCoordInput(`${latitude}, ${longitude}`);
    } else {
      setCoordInput("");
    }
  }, [latitude, longitude]);

  const parseAndApply = (text: string) => {
    const parts = text.trim().split(/[\s,]+/);
    if (parts.length >= 2) {
      const la = parseFloat(parts[0]);
      const lo = parseFloat(parts[1]);
      if (!isNaN(la) && !isNaN(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180) {
        onChange(la, lo);
        return;
      }
    }
    toast.error("Invalid coordinates — use 'lat, lng' format");
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
            onClick={() => { onChange(null, null); setAddress(null); setCoordInput(""); }}
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Click the map, drag the pin, search by name, or paste coordinates below.
      </p>
      <LocationPickerMap value={value} onChange={(lat, lng) => onChange(lat, lng)} onAddress={setAddress} />
      <Input
        placeholder="Paste coordinates e.g. 22.5718, 88.4617"
        value={coordInput}
        onChange={(e) => setCoordInput(e.target.value)}
        onBlur={() => coordInput && parseAndApply(coordInput)}
        onKeyDown={(e) => e.key === "Enter" && coordInput && parseAndApply(coordInput)}
      />
      {address && <p className="text-xs text-muted-foreground">{address}</p>}
    </div>
  );
}
