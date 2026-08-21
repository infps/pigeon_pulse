"use client";

import type { Event, Race } from "@/lib/types";
import { useListRaces, useCreateRace, useUpdateRace, useDeleteRace } from "@/lib/api/races";
import { useSeasonContext } from "@/lib/season-context";
import { useListRaceTypes } from "@/lib/api/race-types";
import { useStations } from "@/lib/api/stations";
import { haversine } from "@/lib/geo";
import { StationsMap } from "@/components/map";
import { resolveTypeColor } from "@/lib/type-color";
import { WEATHER_OPTIONS, getWeatherIcon } from "@/lib/weather-constants";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { createRacesColumns } from "./races-columns";
import { Button } from "@/components/ui/button";
import { Plus, CloudSun, Loader2 } from "lucide-react";
import { useState } from "react";
import { fetchReleaseForecast } from "@/lib/weather-forecast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface RacesTabProps {
  event: Event;
  eventId: string;
}

export function RacesTab({ event, eventId }: RacesTabProps) {
  const { selectedSeasonId } = useSeasonContext();
  const raceParams: Record<string, string> = selectedSeasonId
    ? { seasonId: String(selectedSeasonId) }
    : { eventId };
  const { data, isPending, error } = useListRaces({ params: raceParams });
  const { data: raceTypesData } = useListRaceTypes();
  const { data: stationsData } = useStations(eventId);
  const createRaceMutation = useCreateRace();
  const updateRaceMutation = useUpdateRace();
  const deleteRaceMutation = useDeleteRace();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [fetchingWx, setFetchingWx] = useState(false);
  const [formData, setFormData] = useState({
    raceTypeId: "",
    raceStationId: "",
    name: "",
    description: "",
    distance: "",
    location: "",
    startTime: "",
    sunrise: "",
    sunset: "",
    arrivalTemperature: "",
    arrivalWind: "",
    arrivalWeather: "",
    temperature: "",
    wind: "",
    weather: "",
    isClosed: 0 as number,
    season: "",
  });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error loading races</p>
      </div>
    );
  }

  const races: Race[] = data?.races || [];
  const raceTypes = raceTypesData?.raceTypes || [];

  // Launch-station picker: active stations + the loft base point from the event.
  const activeStations = (stationsData?.stations ?? []).filter((s) => s.isActive);
  const selectedStation = activeStations.find(
    (s) => String(s.id) === formData.raceStationId,
  );
  const hasLoft = event.latitude != null && event.longitude != null;
  const loftBase = hasLoft
    ? { lat: event.latitude as number, lng: event.longitude as number, name: event.name ?? "Loft" }
    : null;
  const derivedMiles =
    selectedStation == null
      ? null
      : selectedStation.miles ??
        (hasLoft && selectedStation.latitude != null && selectedStation.longitude != null
          ? haversine(
              event.latitude as number,
              event.longitude as number,
              selectedStation.latitude,
              selectedStation.longitude,
            ).miles
          : null);

  // One fetch fills both condition blocks:
  //  - Release: forecast at the liberation point (launch station)
  //  - Arrival: forecast at the loft (event base point)
  // Both use the release start time (no separate arrival time field).
  const handleFetchForecast = async () => {
    const stLat = selectedStation?.latitude;
    const stLon = selectedStation?.longitude;
    if (stLat == null || stLon == null) {
      toast.error("Select a launch station with coordinates first");
      return;
    }
    if (!formData.startTime) {
      toast.error("Set the release start time first");
      return;
    }
    const hasLoftCoords = event.latitude != null && event.longitude != null;
    setFetchingWx(true);
    try {
      const [release, arrival] = await Promise.all([
        fetchReleaseForecast(stLat, stLon, formData.startTime),
        hasLoftCoords
          ? fetchReleaseForecast(event.latitude as number, event.longitude as number, formData.startTime)
          : Promise.resolve(null),
      ]);
      setFormData((prev) => ({
        ...prev,
        temperature: String(release.temperatureC),
        wind: `${release.windKph} km/h`,
        weather: release.weather,
        ...(arrival
          ? {
              arrivalTemperature: String(arrival.temperatureC),
              arrivalWind: `${arrival.windKph} km/h`,
              arrivalWeather: arrival.weather,
            }
          : {}),
      }));
      toast.success(
        arrival
          ? "Forecast filled for release + arrival"
          : "Release forecast filled (loft has no coordinates for arrival)"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch forecast");
    } finally {
      setFetchingWx(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRaceMutation.mutateAsync) return;

    // Convert time-only inputs to full datetime based on start time
    const startTimeObj = new Date(formData.startTime);
    const [sunriseHours, sunriseMinutes] = formData.sunrise.split(":");
    const [sunsetHours, sunsetMinutes] = formData.sunset.split(":");

    const sunriseDateTime = new Date(startTimeObj);
    sunriseDateTime.setHours(
      parseInt(sunriseHours),
      parseInt(sunriseMinutes),
      0,
      0
    );

    const sunsetDateTime = new Date(startTimeObj);
    sunsetDateTime.setHours(
      parseInt(sunsetHours),
      parseInt(sunsetMinutes),
      0,
      0
    );

    try {
      await createRaceMutation.mutateAsync({
        raceTypeId: formData.raceTypeId,
        eventId,
        name: formData.name,
        description: formData.description || undefined,
        raceStationId: formData.raceStationId || undefined,
        distance: formData.raceStationId
          ? undefined
          : formData.distance
            ? parseInt(formData.distance)
            : undefined,
        location: formData.location,
        startTime: new Date(formData.startTime).toISOString(),
        sunrise: sunriseDateTime.toISOString(),
        sunset: sunsetDateTime.toISOString(),
        arrivalTemperature: formData.arrivalTemperature
          ? parseFloat(formData.arrivalTemperature)
          : undefined,
        arrivalWind: formData.arrivalWind || undefined,
        arrivalWeather: formData.arrivalWeather || undefined,
        temperature: formData.temperature
          ? parseFloat(formData.temperature)
          : undefined,
        wind: formData.wind || undefined,
        weather: formData.weather || undefined,
        isClosed: formData.isClosed,
        season: formData.season || undefined,
      });

      toast.success("Race created successfully");
      setIsDialogOpen(false);
      setEditingRace(null);
      setFormData({
        raceTypeId: "",
        raceStationId: "",
        name: "",
        description: "",
        distance: "",
        location: "",
        startTime: "",
        sunrise: "",
        sunset: "",
        arrivalTemperature: "",
        arrivalWind: "",
        arrivalWeather: "",
        temperature: "",
        wind: "",
        weather: "",
        isClosed: 0,
        season: "",
      });
    } catch (error) {
      toast.error("Failed to create race");
      console.error("Error creating race:", error);
    }
  };
function toDateTimeLocal(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
  const handleEdit = (race: Race) => {
    setEditingRace(race);
    const sunriseTime = race.sunrise ? new Date(race.sunrise) : null;
    const sunsetTime = race.sunset ? new Date(race.sunset) : null;

    setFormData({
      raceTypeId: String(race.raceTypeId ?? ""),
      raceStationId: String(race.raceStationId ?? ""),
      name: race.name ?? "",
      description: race.description || "",
      distance: race.distance?.toString() ?? "",
      location: race.location || "",
      startTime: race.startTime ? toDateTimeLocal(race.startTime) : "",
      sunrise: sunriseTime ? sunriseTime.toTimeString().slice(0, 5) : "",
      sunset: sunsetTime ? sunsetTime.toTimeString().slice(0, 5) : "",
      arrivalTemperature: race.arrivalTemperature?.toString() || "",
      arrivalWind: race.arrivalWind || "",
      arrivalWeather: race.arrivalWeather || "",
      temperature: race.temperature?.toString() || "",
      wind: race.wind || "",
      weather: race.weather || "",
      isClosed: race.isClosed ?? 0,
      season: race.season ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateRaceMutation.mutateAsync || !editingRace) return;

    // Convert time-only inputs to full datetime based on start time
    const startTimeObj = new Date(formData.startTime);
    const [sunriseHours, sunriseMinutes] = formData.sunrise.split(":");
    const [sunsetHours, sunsetMinutes] = formData.sunset.split(":");

    const sunriseDateTime = new Date(startTimeObj);
    sunriseDateTime.setHours(
      parseInt(sunriseHours),
      parseInt(sunriseMinutes),
      0,
      0
    );

    const sunsetDateTime = new Date(startTimeObj);
    sunsetDateTime.setHours(
      parseInt(sunsetHours),
      parseInt(sunsetMinutes),
      0,
      0
    );

    try {
      await updateRaceMutation.mutateAsync({
        raceId: editingRace.id,
        raceTypeId: formData.raceTypeId,
        eventId,
        name: formData.name,
        description: formData.description || undefined,
        raceStationId: formData.raceStationId || undefined,
        distance: formData.raceStationId
          ? undefined
          : formData.distance
            ? parseInt(formData.distance)
            : undefined,
        location: formData.location,
        startTime: formData.startTime,
        sunrise: sunriseDateTime.toISOString(),
        sunset: sunsetDateTime.toISOString(),
        arrivalTemperature: formData.arrivalTemperature
          ? parseFloat(formData.arrivalTemperature)
          : undefined,
        arrivalWind: formData.arrivalWind || undefined,
        arrivalWeather: formData.arrivalWeather || undefined,
        temperature: formData.temperature
          ? parseFloat(formData.temperature)
          : undefined,
        wind: formData.wind || undefined,
        weather: formData.weather || undefined,
        isClosed: formData.isClosed,
        season: formData.season || undefined,
      });

      toast.success("Race updated successfully");
      setIsDialogOpen(false);
      setEditingRace(null);
      setFormData({
        raceTypeId: "",
        raceStationId: "",
        name: "",
        description: "",
        distance: "",
        location: "",
        startTime: "",
        sunrise: "",
        sunset: "",
        arrivalTemperature: "",
        arrivalWind: "",
        arrivalWeather: "",
        temperature: "",
        wind: "",
        weather: "",
        isClosed: 0,
        season: "",
      });
    } catch (error) {
      toast.error("Failed to update race");
      console.error("Error updating race:", error);
    }
  };

  const handleDelete = async (raceId: number) => {
    if (!confirm("Are you sure you want to delete this race?")) return;

    try {
      if(!deleteRaceMutation.mutateAsync) return;
      await deleteRaceMutation.mutateAsync({ raceId });
      toast.success("Race deleted successfully");
    } catch (error) {
      toast.error("Failed to delete race");
      console.error("Error deleting race:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => {
          setEditingRace(null);
          setFormData({
            raceTypeId: "",
            raceStationId: "",
            name: "",
            description: "",
            distance: "",
            location: "",
            startTime: "",
            sunrise: "",
            sunset: "",
            arrivalTemperature: "",
            arrivalWind: "",
            arrivalWeather: "",
            temperature: "",
            wind: "",
            weather: "",
            isClosed: 0,
            season: "",
          });
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Race
        </Button>
      </div>

      <DataTable
        tableId="event-races"
        columns={createRacesColumns(handleEdit, handleDelete, eventId)}
        data={races}
        filterableColumns={[
          { id: "name", title: "Race Name" },
          { id: "location", title: "Location" },
          { id: "status", title: "Status" },
          { id: "distance", title: "Distance" },
          { id: "arrivalWeather", title: "Weather" },
        ]}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRace ? "Edit Race" : "Create New Race"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={editingRace ? handleUpdate : handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="raceTypeId">Race Type *</Label>
                  <Select
                    value={formData.raceTypeId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, raceTypeId: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select race type" />
                    </SelectTrigger>
                    <SelectContent>
                      {raceTypes.map((raceType: any) => (
                        <SelectItem key={raceType.id} value={String(raceType.id)}>
                          {raceType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Race Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Spring Classic 2026"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="launchStation">Launch Station</Label>
                  <Select
                    value={formData.raceStationId || "none"}
                    onValueChange={(value) => {
                      const id = value === "none" ? "" : value;
                      const st = activeStations.find((s) => String(s.id) === id);
                      // Autofill race type from the station's first type (if exactly one set).
                      const firstType = st?.stationRaceTypes?.[0];
                      const rtId =
                        st?.stationRaceTypes?.length === 1 && firstType
                          ? String(firstType.raceTypeId)
                          : formData.raceTypeId;
                      setFormData({
                        ...formData,
                        raceStationId: id,
                        raceTypeId: rtId,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full" id="launchStation">
                      <SelectValue placeholder="Select launch station" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No station</SelectItem>
                      {activeStations.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                          {s.miles != null ? ` — ${s.miles.toFixed(2)} mi` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!hasLoft && (
                    <p className="text-xs text-amber-600">
                      Set the event location (Edit tab) to enable station distance + path.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (miles) *</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="1"
                    value={selectedStation ? (derivedMiles != null ? String(Math.round(derivedMiles)) : "") : formData.distance}
                    onChange={(e) =>
                      setFormData({ ...formData, distance: e.target.value })
                    }
                    disabled={!!selectedStation}
                    required
                  />
                  {selectedStation && (
                    <p className="text-xs text-muted-foreground">
                      Locked to launch station distance.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="season">Season</Label>
                  <Input
                    id="season"
                    placeholder="e.g. YB25"
                    value={formData.season}
                    onChange={(e) =>
                      setFormData({ ...formData, season: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Launch path: station → loft */}
            {hasLoft && selectedStation && (
              <div className="space-y-2">
                <h3 className="font-semibold">Launch Path</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedStation.name} → {loftBase?.name}
                  {derivedMiles != null ? ` (${derivedMiles.toFixed(2)} mi)` : ""}
                </p>
                <StationsMap
                  base={loftBase}
                  stations={[
                    {
                      id: selectedStation.id,
                      name: selectedStation.name,
                      latitude: selectedStation.latitude,
                      longitude: selectedStation.longitude,
                      miles: derivedMiles,
                      isActive: selectedStation.isActive,
                      color: selectedStation.stationRaceTypes?.[0]
                        ? resolveTypeColor(selectedStation.stationRaceTypes[0].raceTypeId, selectedStation.stationRaceTypes[0].raceType?.color)
                        : undefined,
                    },
                  ]}
                  height={260}
                />
              </div>
            )}

            {/* Date & Time Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Date & Time Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sunrise">Sunrise Time *</Label>
                  <Input
                    id="sunrise"
                    type="time"
                    value={formData.sunrise}
                    onChange={(e) =>
                      setFormData({ ...formData, sunrise: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sunset">Sunset Time *</Label>
                  <Input
                    id="sunset"
                    type="time"
                    value={formData.sunset}
                    onChange={(e) =>
                      setFormData({ ...formData, sunset: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* Arrival Conditions */}
            <div className="space-y-4">
              <h3 className="font-semibold">Arrival Conditions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="arrivalTemperature">
                    Temperature (°C)
                  </Label>
                  <Input
                    id="arrivalTemperature"
                    type="number"
                    step="0.1"
                    value={formData.arrivalTemperature}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        arrivalTemperature: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalWind">Wind</Label>
                  <Input
                    id="arrivalWind"
                    value={formData.arrivalWind}
                    onChange={(e) =>
                      setFormData({ ...formData, arrivalWind: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalWeather">Weather</Label>
                  <Select
                    value={formData.arrivalWeather}
                    onValueChange={(value) =>
                      setFormData({ ...formData, arrivalWeather: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select weather" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEATHER_OPTIONS.map((weather) => (
                        <SelectItem key={weather} value={weather}>
                          <div className="flex items-center gap-2">
                            {getWeatherIcon(weather)}
                            <span>{weather}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Release Conditions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Release Conditions</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchForecast}
                  disabled={fetchingWx}
                >
                  {fetchingWx ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CloudSun className="h-4 w-4" />
                  )}
                  Fetch Forecast
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Temperature (°C)
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        temperature: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wind">Wind</Label>
                  <Input
                    id="wind"
                    value={formData.wind}
                    onChange={(e) =>
                      setFormData({ ...formData, wind: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weather">Weather</Label>
                  <Select
                    value={formData.weather}
                    onValueChange={(value) =>
                      setFormData({ ...formData, weather: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select weather" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEATHER_OPTIONS.map((weather) => (
                        <SelectItem key={weather} value={weather}>
                          <div className="flex items-center gap-2">
                            {getWeatherIcon(weather)}
                            <span>{weather}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isClosed"
                  checked={formData.isClosed === 1}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isClosed: checked ? 1 : 0 })
                  }
                />
                <Label htmlFor="isClosed" className="cursor-pointer">
                  Mark as Closed
                </Label>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingRace(null);
                  setFormData({
                    raceTypeId: "",
                    raceStationId: "",
                    name: "",
                    description: "",
                    distance: "",
                    location: "",
                    startTime: "",
                    sunrise: "",
                    sunset: "",
                    arrivalTemperature: "",
                    arrivalWind: "",
                    arrivalWeather: "",
                    temperature: "",
                    wind: "",
                    weather: "",
                    isClosed: 0,
                    season: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editingRace ? updateRaceMutation.isPending : createRaceMutation.isPending}
              >
                {editingRace
                  ? updateRaceMutation.isPending
                    ? "Updating..."
                    : "Update Race"
                  : createRaceMutation.isPending
                  ? "Creating..."
                  : "Create Race"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
