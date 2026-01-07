"use client";

import type { Event, Race } from "@/lib/types";
import { useListRaces, useCreateRace, useUpdateRace, useDeleteRace } from "@/lib/api/races";
import { useListRaceTypes } from "@/lib/api/race-types";
import { WEATHER_OPTIONS, getWeatherIcon } from "@/lib/weather-constants";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { createRacesColumns } from "./races-columns";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
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
  const { data, isPending, error } = useListRaces({ params: { eventId } });
  const { data: raceTypesData } = useListRaceTypes();
  const createRaceMutation = useCreateRace();
  const updateRaceMutation = useUpdateRace();
  const deleteRaceMutation = useDeleteRace();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [formData, setFormData] = useState({
    raceTypeId: "",
    name: "",
    description: "",
    distance: "",
    releaseStation: "",
    releaseDate: "",
    sunriseTime: "",
    sunsetTime: "",
    arrivalTemperature: "",
    arrivalWind: "",
    arrivalWeather: "",
    releaseTemperature: "",
    releaseWind: "",
    releaseWeather: "",
    isClosed: false,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRaceMutation.mutateAsync) return;

    // Convert time-only inputs to full datetime based on release date
    const releaseDateObj = new Date(formData.releaseDate);
    const [sunriseHours, sunriseMinutes] = formData.sunriseTime.split(":");
    const [sunsetHours, sunsetMinutes] = formData.sunsetTime.split(":");

    const sunriseDateTime = new Date(releaseDateObj);
    sunriseDateTime.setHours(
      parseInt(sunriseHours),
      parseInt(sunriseMinutes),
      0,
      0
    );

    const sunsetDateTime = new Date(releaseDateObj);
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
        distance: parseFloat(formData.distance),
        releaseStation: formData.releaseStation,
        releaseDate: new Date(formData.releaseDate).toISOString(),
        sunriseTime: sunriseDateTime.toISOString(),
        sunsetTime: sunsetDateTime.toISOString(),
        arrivalTemperature: formData.arrivalTemperature
          ? parseFloat(formData.arrivalTemperature)
          : undefined,
        arrivalWind: formData.arrivalWind || undefined,
        arrivalWeather: formData.arrivalWeather || undefined,
        releaseTemperature: formData.releaseTemperature
          ? parseFloat(formData.releaseTemperature)
          : undefined,
        releaseWind: formData.releaseWind || undefined,
        releaseWeather: formData.releaseWeather || undefined,
        isClosed: formData.isClosed,
      });

      toast.success("Race created successfully");
      setIsDialogOpen(false);
      setEditingRace(null);
      setFormData({
        raceTypeId: "",
        name: "",
        description: "",
        distance: "",
        releaseStation: "",
        releaseDate: "",
        sunriseTime: "",
        sunsetTime: "",
        arrivalTemperature: "",
        arrivalWind: "",
        arrivalWeather: "",
        releaseTemperature: "",
        releaseWind: "",
        releaseWeather: "",
        isClosed: false,
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
    const releaseDate = new Date(race.releaseDate);
    const sunriseTime = new Date(race.sunriseTime);
    const sunsetTime = new Date(race.sunsetTime);
    
    setFormData({
      raceTypeId: race.raceTypeId,
      name: race.name,
      description: race.description || "",
      distance: race.distance.toString(),
      releaseStation: race.releaseStation,
      releaseDate: toDateTimeLocal(race.releaseDate),
      sunriseTime: sunriseTime.toTimeString().slice(0, 5),
      sunsetTime: sunsetTime.toTimeString().slice(0, 5),
      arrivalTemperature: race.arrivalTemperature?.toString() || "",
      arrivalWind: race.arrivalWind || "",
      arrivalWeather: race.arrivalWeather || "",
      releaseTemperature: race.releaseTemperature?.toString() || "",
      releaseWind: race.releaseWind || "",
      releaseWeather: race.releaseWeather || "",
      isClosed: race.isClosed,
    });
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateRaceMutation.mutateAsync || !editingRace) return;

    // Convert time-only inputs to full datetime based on release date
    const releaseDateObj = new Date(formData.releaseDate);
    const [sunriseHours, sunriseMinutes] = formData.sunriseTime.split(":");
    const [sunsetHours, sunsetMinutes] = formData.sunsetTime.split(":");

    const sunriseDateTime = new Date(releaseDateObj);
    sunriseDateTime.setHours(
      parseInt(sunriseHours),
      parseInt(sunriseMinutes),
      0,
      0
    );

    const sunsetDateTime = new Date(releaseDateObj);
    sunsetDateTime.setHours(
      parseInt(sunsetHours),
      parseInt(sunsetMinutes),
      0,
      0
    );

    try {
      await updateRaceMutation.mutateAsync({
        raceId: editingRace.raceId,
        raceTypeId: formData.raceTypeId,
        eventId,
        name: formData.name,
        description: formData.description || undefined,
        distance: parseFloat(formData.distance),
        releaseStation: formData.releaseStation,
        releaseDate: formData.releaseDate,
        sunriseTime: sunriseDateTime.toISOString(),
        sunsetTime: sunsetDateTime.toISOString(),
        arrivalTemperature: formData.arrivalTemperature
          ? parseFloat(formData.arrivalTemperature)
          : undefined,
        arrivalWind: formData.arrivalWind || undefined,
        arrivalWeather: formData.arrivalWeather || undefined,
        releaseTemperature: formData.releaseTemperature
          ? parseFloat(formData.releaseTemperature)
          : undefined,
        releaseWind: formData.releaseWind || undefined,
        releaseWeather: formData.releaseWeather || undefined,
        isClosed: formData.isClosed,
      });

      toast.success("Race updated successfully");
      setIsDialogOpen(false);
      setEditingRace(null);
      setFormData({
        raceTypeId: "",
        name: "",
        description: "",
        distance: "",
        releaseStation: "",
        releaseDate: "",
        sunriseTime: "",
        sunsetTime: "",
        arrivalTemperature: "",
        arrivalWind: "",
        arrivalWeather: "",
        releaseTemperature: "",
        releaseWind: "",
        releaseWeather: "",
        isClosed: false,
      });
    } catch (error) {
      toast.error("Failed to update race");
      console.error("Error updating race:", error);
    }
  };

  const handleDelete = async (raceId: string) => {
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
            name: "",
            description: "",
            distance: "",
            releaseStation: "",
            releaseDate: "",
            sunriseTime: "",
            sunsetTime: "",
            arrivalTemperature: "",
            arrivalWind: "",
            arrivalWeather: "",
            releaseTemperature: "",
            releaseWind: "",
            releaseWeather: "",
            isClosed: false,
          });
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Race
        </Button>
      </div>

      <DataTable 
        columns={createRacesColumns(handleEdit, handleDelete, eventId)} 
        data={races}
        filterableColumns={[
          { id: "name", title: "Race Name" },
          { id: "releaseStation", title: "Release Station" },
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
                        <SelectItem key={raceType.id} value={raceType.id}>
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
                  <Label htmlFor="releaseStation">Release Station *</Label>
                  <Input
                    id="releaseStation"
                    value={formData.releaseStation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        releaseStation: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (miles) *</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.01"
                    value={formData.distance}
                    onChange={(e) =>
                      setFormData({ ...formData, distance: e.target.value })
                    }
                    required
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

            {/* Date & Time Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Date & Time Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="releaseDate">Release Date *</Label>
                  <Input
                    id="releaseDate"
                    type="datetime-local"
                    value={formData.releaseDate}
                    onChange={(e) =>
                      setFormData({ ...formData, releaseDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sunriseTime">Sunrise Time *</Label>
                  <Input
                    id="sunriseTime"
                    type="time"
                    value={formData.sunriseTime}
                    onChange={(e) =>
                      setFormData({ ...formData, sunriseTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sunsetTime">Sunset Time *</Label>
                  <Input
                    id="sunsetTime"
                    type="time"
                    value={formData.sunsetTime}
                    onChange={(e) =>
                      setFormData({ ...formData, sunsetTime: e.target.value })
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
              <h3 className="font-semibold">Release Conditions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="releaseTemperature">
                    Temperature (°C)
                  </Label>
                  <Input
                    id="releaseTemperature"
                    type="number"
                    step="0.1"
                    value={formData.releaseTemperature}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        releaseTemperature: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="releaseWind">Wind</Label>
                  <Input
                    id="releaseWind"
                    value={formData.releaseWind}
                    onChange={(e) =>
                      setFormData({ ...formData, releaseWind: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="releaseWeather">Weather</Label>
                  <Select
                    value={formData.releaseWeather}
                    onValueChange={(value) =>
                      setFormData({ ...formData, releaseWeather: value })
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
                  checked={formData.isClosed}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isClosed: !!checked })
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
                    name: "",
                    description: "",
                    distance: "",
                    releaseStation: "",
                    releaseDate: "",
                    sunriseTime: "",
                    sunsetTime: "",
                    arrivalTemperature: "",
                    arrivalWind: "",
                    arrivalWeather: "",
                    releaseTemperature: "",
                    releaseWind: "",
                    releaseWeather: "",
                    isClosed: false,
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
