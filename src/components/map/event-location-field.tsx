"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LocationPickerMap } from "@/components/map";

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

export function EventLocationField({ latitude, longitude, onChange }: Props) {
  const value = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Event Location</Label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null, null)}
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Click the map (or drag the pin) to set the event/home point. Station distances are measured from here.
      </p>
      <LocationPickerMap value={value} onChange={(lat, lng) => onChange(lat, lng)} />
      <p className="text-xs text-muted-foreground">
        {value
          ? `Lat ${value.lat.toFixed(6)}, Lng ${value.lng.toFixed(6)}`
          : "No location set"}
      </p>
    </div>
  );
}
